// Attachment storage. Bytes are written first (async); rows are inserted inside the caller's
// transaction so a failed action never leaves half-recorded evidence.

import type { Attachment, AttachmentContext } from "../../core/types";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { AttachmentRow } from "../db/schema";
import { badRequest, newId } from "./util";

export interface IncomingFile {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface StoredFile {
  id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

const ALLOWED = [
  /^image\/(png|jpeg|gif|webp|svg\+xml)$/,
  /^video\/(mp4|webm|quicktime)$/,
  /^text\/(plain|csv)$/,
  /^application\/(pdf|json|zip|x-zip-compressed)$/,
];

export const MAX_FILES_PER_REQUEST = 10;

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").trim();
  return (cleaned || "file").slice(0, 120);
}

export function normalizeMime(file: IncomingFile): string {
  const type = (file.type || "").toLowerCase();
  if (ALLOWED.some((r) => r.test(type))) return type;
  const lower = file.name.toLowerCase();
  if (/\.(log|txt|har)$/.test(lower)) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return "application/octet-stream";
}

export async function storeFiles(ctx: AppContext, files: IncomingFile[]): Promise<StoredFile[]> {
  if (files.length > MAX_FILES_PER_REQUEST) throw badRequest(`Attach at most ${MAX_FILES_PER_REQUEST} files at a time.`);
  const out: StoredFile[] = [];
  for (const f of files) {
    if (f.size > ctx.config.maxUploadBytes) {
      throw badRequest(`${f.name} is larger than ${Math.round(ctx.config.maxUploadBytes / 1_048_576)} MB.`);
    }
    if (f.size === 0) throw badRequest(`${f.name} is empty.`);
  }
  for (const f of files) {
    const id = newId("att");
    const month = nowIso(ctx).slice(0, 7);
    const storage_key = `${month}/${id}`;
    const mime_type = normalizeMime(f);
    await ctx.files.put(storage_key, f.blob.type === mime_type ? f.blob : new Blob([f.blob], { type: mime_type }));
    out.push({ id, storage_key, filename: sanitizeFilename(f.name), mime_type, size_bytes: f.size });
  }
  return out;
}

export async function discardFiles(ctx: AppContext, stored: StoredFile[]): Promise<void> {
  await Promise.all(stored.map((s) => ctx.files.delete(s.storage_key).catch(() => undefined)));
}

export function insertAttachments(
  ctx: AppContext,
  stored: StoredFile[],
  opts: { bugId: string; uploaderId: string; context: AttachmentContext; commentId?: string | null; runId?: string | null },
): AttachmentRow[] {
  return stored.map((s) =>
    ctx.store.insert("attachments", {
      id: s.id,
      bug_id: opts.bugId,
      comment_id: opts.commentId ?? null,
      regression_run_id: opts.runId ?? null,
      uploader_id: opts.uploaderId,
      filename: s.filename,
      mime_type: s.mime_type,
      size_bytes: s.size_bytes,
      storage_key: s.storage_key,
      context: opts.context,
      width: null,
      height: null,
      created_at: nowIso(ctx),
    }),
  );
}

export function toAttachment(row: AttachmentRow): Attachment {
  const { storage_key: _k, width: _w, height: _h, ...rest } = row;
  return { ...rest, url: `/api/attachments/${row.id}/content` };
}

/** Run a synchronous DB transaction after files were written; clean the files up if it fails. */
export async function withStoredFiles<T>(ctx: AppContext, files: IncomingFile[], fn: (stored: StoredFile[]) => T): Promise<T> {
  const stored = await storeFiles(ctx, files);
  try {
    return ctx.store.transaction(() => fn(stored));
  } catch (err) {
    await discardFiles(ctx, stored);
    throw err;
  }
}
