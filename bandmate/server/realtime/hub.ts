import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from 'ws'
import { onNotify } from '../lib/events.ts'
import { newId } from '../lib/util.ts'
import type { AuthUser } from '../lib/auth.ts'

export type Client = { id: string; user: AuthUser; ws: WebSocket; alive: boolean; lastMsgAt: number[] }
export type Inbound = { t: string; [k: string]: unknown }
type Handler = (client: Client, msg: Inbound) => void | Promise<void>
type CloseHandler = (client: Client) => void

const byUser = new Map<string, Set<Client>>()
const handlers = new Map<string, Handler>()
const closeHandlers: CloseHandler[] = []

/** Feature modules (calls, battles) register message handlers by type prefix, e.g. "match." or "call.". */
export const onMessage = (prefix: string, fn: Handler) => handlers.set(prefix, fn)
export const onClose = (fn: CloseHandler) => closeHandlers.push(fn)

export const send = (c: Client | undefined, msg: Record<string, unknown>) => {
  if (c && c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg))
}
export const sendUser = (userId: string, msg: Record<string, unknown>) => byUser.get(userId)?.forEach((c) => send(c, msg))
export const clientsOf = (userId: string) => [...(byUser.get(userId) ?? [])]
export const findClient = (userId: string, clientId: string) => clientsOf(userId).find((c) => c.id === clientId)
export const isOnline = (userId: string) => (byUser.get(userId)?.size ?? 0) > 0

onNotify((userId, n) => sendUser(userId, { t: 'notify', ...n }))

const MAX_MSGS_PER_10S = 120 // ICE candidates arrive in bursts; this still stops floods.

export const realtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket, req) => {
    if (!req.user || req.user.status === 'banned') {
      socket.send(JSON.stringify({ t: 'error', code: 'unauthenticated', message: 'Please log in again.' }))
      socket.close(4401, 'unauthenticated')
      return
    }
    const client: Client = { id: newId('c_'), user: req.user, ws: socket, alive: true, lastMsgAt: [] }
    if (!byUser.has(client.user.id)) byUser.set(client.user.id, new Set())
    byUser.get(client.user.id)!.add(client)
    send(client, { t: 'hello', clientId: client.id })

    socket.on('pong', () => (client.alive = true))
    socket.on('message', async (raw) => {
      const t = Date.now()
      client.lastMsgAt = client.lastMsgAt.filter((x) => t - x < 10_000)
      client.lastMsgAt.push(t)
      if (client.lastMsgAt.length > MAX_MSGS_PER_10S) return send(client, { t: 'error', code: 'rate_limited', message: 'Too many messages.' })
      let msg: Inbound
      try {
        msg = JSON.parse(String(raw))
        if (typeof msg?.t !== 'string') throw new Error('bad message')
      } catch {
        return send(client, { t: 'error', code: 'bad_message', message: 'Malformed message.' })
      }
      if (msg.t === 'ping') return send(client, { t: 'pong' })
      const prefix = msg.t.slice(0, msg.t.indexOf('.') + 1)
      const h = handlers.get(prefix)
      if (!h) return send(client, { t: 'error', code: 'unknown_type', message: `Unknown message type ${msg.t}` })
      try {
        await h(client, msg)
      } catch (e) {
        const err = e as { code?: string; message: string; extra?: Record<string, unknown> }
        send(client, { t: 'error', for: msg.t, code: err.code ?? 'server_error', message: err.code ? err.message : 'Something went wrong.', ...(err.extra ?? {}) })
        if (!err.code) req.log.error(e)
      }
    })
    socket.on('close', () => {
      byUser.get(client.user.id)?.delete(client)
      if (byUser.get(client.user.id)?.size === 0) byUser.delete(client.user.id)
      for (const h of closeHandlers) h(client)
    })
  })

  // Heartbeat: a socket that misses a ping round is considered gone (network loss, sleeping phone).
  const timer = setInterval(() => {
    for (const set of byUser.values())
      for (const c of set) {
        if (!c.alive) {
          c.ws.terminate()
          continue
        }
        c.alive = false
        c.ws.ping()
      }
  }, 10_000)
  app.addHook('onClose', async () => clearInterval(timer))
}
