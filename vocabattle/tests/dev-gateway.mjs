#!/usr/bin/env node
// =============================================================================
// DEV/TEST ONLY — a tiny stand-in for the Supabase API gateway.
//
// It lets the real mobile web build run end-to-end against a local PostgreSQL
// that has the real migrations applied (used by tests/e2e). It implements only
// the subset of Supabase Auth (GoTrue) and PostgREST the app uses:
//   POST /auth/v1/signup, /auth/v1/token?grant_type=password|refresh_token,
//   GET/PUT /auth/v1/user, POST /auth/v1/logout|recover|resend
//   POST /rest/v1/rpc/<fn>; GET/PATCH/DELETE /rest/v1/<table> with simple filters
// Every data request runs as role `authenticated` with the caller's JWT claims,
// so RLS policies and grants are enforced exactly as in production.
// Realtime is NOT emulated (the app falls back to polling).
//
// NEVER deploy this. Production uses a real Supabase project.
// =============================================================================
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, normalize } from 'node:path';

import pg from 'pg';

const PORT = Number(process.env.GATEWAY_PORT ?? 8787);
const STATIC_DIR = process.env.STATIC_DIR ?? null;
const SECRET = process.env.DEV_JWT_SECRET ?? 'dev-only-secret-not-for-production';
const pool = new pg.Pool({
  database: process.env.TEST_DB ?? 'vocabattle_test',
  user: process.env.PGUSER ?? process.env.USER ?? 'root',
  host: process.env.PGHOST ?? '/var/run/postgresql',
  max: 20,
});

await pool.query(`
  create schema if not exists dev_auth;
  create table if not exists dev_auth.credentials (user_id uuid primary key references auth.users(id) on delete cascade, password_hash text not null);
  create table if not exists dev_auth.refresh_tokens (token text primary key, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz default now());
`);

// ------------------------------------------------------------------ JWT
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function verify(token) {
  const [h, b, s] = (token ?? '').split('.');
  if (!h || !b || !s) return null;
  const expected = createHmac('sha256', SECRET).update(`${h}.${b}`).digest('base64url');
  if (expected !== s) return null;
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}

function userJson(u) {
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.created_at, confirmed_at: u.created_at, last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.raw_user_meta_data ?? {},
    identities: [], created_at: u.created_at, updated_at: u.created_at,
  };
}
async function session(u) {
  const expiresIn = 3600;
  const refresh = randomBytes(24).toString('hex');
  await pool.query('insert into dev_auth.refresh_tokens (token, user_id) values ($1, $2)', [refresh, u.id]);
  return {
    access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: Math.floor(Date.now() / 1000) + expiresIn }),
    token_type: 'bearer', expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: refresh, user: userJson(u),
  };
}

// ------------------------------------------------------------------ helpers
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, prefer, accept, accept-profile, content-profile, x-supabase-api-version, range',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range',
};
function send(res, status, body, headers = {}) {
  if (status >= 400 && process.env.GATEWAY_LOG !== '0') console.log(`[${status}] ${res.req?.method} ${res.req?.url} → ${JSON.stringify(body).slice(0, 200)}`);
  res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  return text ? JSON.parse(text) : {};
}
function pgError(res, e) {
  const status = e.code === '42501' ? 403 : e.code === 'P0002' ? 404 : e.code === '28000' ? 401 : 400;
  send(res, status, { code: e.code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}
async function asUser(claims, text, params) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    if (claims) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    const r = await c.query(text, params);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`bad identifier ${s}`), { code: '42601' });
  return `"${s}"`;
};

// PostgREST filter subset: col=eq.v | neq | lt | lte | gt | gte | is.null|true|false | in.(a,b)
function buildWhere(params, values) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(key)) continue;
    const m = /^(not\.)?(eq|neq|lt|lte|gt|gte|is|in)\.(.*)$/s.exec(raw);
    if (!m) throw Object.assign(new Error(`unsupported filter ${key}=${raw}`), { code: 'PGRST100' });
    const [, not, op, val] = m;
    const col = ident(key);
    let sql;
    if (op === 'is') sql = `${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const items = val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      values.push(items);
      sql = `${col}::text = any($${values.length}::text[])`;
    } else {
      values.push(val);
      sql = `${col} ${{ eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' }[op]} $${values.length}`;
    }
    clauses.push(not ? `not (${sql})` : sql);
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}
function buildSelect(params) {
  const sel = params.get('select') ?? '*';
  return sel === '*' ? '*' : sel.split(',').map((c) => ident(c.trim())).join(', ');
}
function buildOrder(params) {
  const o = params.get('order');
  if (!o) return '';
  return ' order by ' + o.split(',').map((part) => {
    const [col, dir, nulls] = part.split('.');
    return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
  }).join(', ');
}

// ------------------------------------------------------------------ server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return send(res, 204);
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const claims = verify(bearer);

  try {
    // ---------------------------------------------------------------- auth
    if (url.pathname.startsWith('/auth/v1/')) {
      const route = url.pathname.slice('/auth/v1/'.length);
      if (route === 'signup' && req.method === 'POST') {
        const { email, password, data } = await readBody(req);
        if (!email || !password || password.length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        const exists = await pool.query('select 1 from auth.users where lower(email) = lower($1)', [email]);
        if (exists.rowCount) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        const { rows: [u] } = await pool.query('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning *', [email.toLowerCase(), data ?? {}]);
        await pool.query(`insert into dev_auth.credentials (user_id, password_hash) values ($1, crypt($2, gen_salt('bf')))`, [u.id, password]);
        return send(res, 200, await session(u));
      }
      if (route === 'token' && req.method === 'POST') {
        const grant = url.searchParams.get('grant_type');
        const body = await readBody(req);
        if (grant === 'password') {
          const { rows: [u] } = await pool.query(
            `select u.* from auth.users u join dev_auth.credentials c on c.user_id = u.id
              where lower(u.email) = lower($1) and c.password_hash = crypt($2, c.password_hash)`, [body.email ?? '', body.password ?? '']);
          if (!u) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return send(res, 200, await session(u));
        }
        if (grant === 'refresh_token') {
          const { rows: [t] } = await pool.query('delete from dev_auth.refresh_tokens where token = $1 returning user_id', [body.refresh_token ?? '']);
          if (!t) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
          const { rows: [u] } = await pool.query('select * from auth.users where id = $1', [t.user_id]);
          return send(res, 200, await session(u));
        }
        return send(res, 400, { code: 400, msg: 'unsupported grant_type' });
      }
      if (route === 'user') {
        if (!claims) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
        const { rows: [u] } = await pool.query('select * from auth.users where id = $1', [claims.sub]);
        if (!u) return send(res, 404, { code: 404, error_code: 'user_not_found', msg: 'User not found' });
        if (req.method === 'PUT') {
          const body = await readBody(req);
          if (body.password) await pool.query(`update dev_auth.credentials set password_hash = crypt($2, gen_salt('bf')) where user_id = $1`, [u.id, body.password]);
        }
        return send(res, 200, userJson(u));
      }
      if (route === 'logout') return send(res, 204);
      if (route === 'recover' || route === 'resend' || route === 'otp') return send(res, 200, {});
      if (route === 'settings') return send(res, 200, { external: { email: true }, mailer_autoconfirm: true });
      return send(res, 404, { code: 404, msg: `auth route ${route} not emulated` });
    }

    // ---------------------------------------------------------------- rest
    if (url.pathname.startsWith('/rest/v1/')) {
      const path = url.pathname.slice('/rest/v1/'.length);
      if (path.startsWith('rpc/')) {
        const fn = ident(path.slice(4));
        const args = req.method === 'GET' ? Object.fromEntries(url.searchParams) : await readBody(req);
        const keys = Object.keys(args);
        const values = keys.map((k) => args[k]);
        const sql = `select public.${fn}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}) as r`;
        const r = await asUser(claims, sql, values);
        return send(res, 200, r.rows[0]?.r ?? null);
      }
      const table = `public.${ident(path)}`;
      const values = [];
      const where = buildWhere(url.searchParams, values);
      const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object');
      const returning = (req.headers.prefer ?? '').includes('return=representation');
      let sql;
      if (req.method === 'GET') {
        const limit = url.searchParams.get('limit');
        const offset = url.searchParams.get('offset');
        sql = `select ${buildSelect(url.searchParams)} from ${table}${where}${buildOrder(url.searchParams)}`
          + (limit ? ` limit ${Number(limit)}` : '') + (offset ? ` offset ${Number(offset)}` : '');
      } else if (req.method === 'PATCH') {
        const body = await readBody(req);
        const sets = Object.keys(body).map((k) => { values.push(body[k] !== null && typeof body[k] === 'object' && !Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k]); return `${ident(k)} = $${values.length}`; });
        sql = `update ${table} set ${sets.join(', ')}${where}${returning ? ` returning ${buildSelect(url.searchParams)}` : ''}`;
      } else if (req.method === 'DELETE') {
        sql = `delete from ${table}${where}${returning ? ' returning *' : ''}`;
      } else {
        return send(res, 405, { message: 'method not emulated' });
      }
      const r = await asUser(claims, sql, values);
      if (wantsObject) {
        if (r.rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${r.rows.length} rows`, hint: null });
        return send(res, 200, r.rows[0]);
      }
      if (req.method !== 'GET' && !returning) return send(res, 204);
      return send(res, 200, r.rows);
    }

    // ---------------------------------------------------------------- static web build
    if (STATIC_DIR && req.method === 'GET') {
      let file = normalize(join(STATIC_DIR, decodeURIComponent(url.pathname)));
      if (!file.startsWith(normalize(STATIC_DIR)) || !existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, 'index.html');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json' };
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
      return createReadStream(file).pipe(res);
    }
    send(res, 404, { message: 'not found' });
  } catch (e) {
    if (e.code) return pgError(res, e);
    console.error(e);
    send(res, 500, { message: e.message });
  }
});

// Realtime websocket is not emulated: refuse upgrades cleanly.
server.on('upgrade', (_req, socket) => socket.destroy());
server.listen(PORT, () => console.log(`dev gateway on http://localhost:${PORT}${STATIC_DIR ? ` (serving ${STATIC_DIR})` : ''} — id ${randomUUID().slice(0, 8)}`));
