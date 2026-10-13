/**
 * Progress photos are stored ONLY in this browser's IndexedDB, keyed by user. They are
 * never uploaded, never shown on leaderboards or battles, and are blurred by default.
 * Images are downscaled before storage to save space.
 *
 * Production: store in private object storage with per-user access control, encryption
 * at rest, signed short-lived URLs, and explicit consent for any sharing.
 */

const DB = 'bodyquest-photos';
const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Photo storage is not available in this browser.'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open photo storage.'));
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePhoto(userId: string, id: string, dataUrl: string): Promise<void> {
  await tx('readwrite', (s) => s.put(dataUrl, `${userId}:${id}`));
}

export async function loadPhoto(userId: string, id: string): Promise<string | undefined> {
  return tx<string | undefined>('readonly', (s) => s.get(`${userId}:${id}`) as IDBRequest<string | undefined>);
}

export async function deletePhoto(userId: string, id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(`${userId}:${id}`));
}

export async function deleteAllPhotos(userId: string): Promise<void> {
  const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  await Promise.all(keys.filter((k) => String(k).startsWith(`${userId}:`)).map((k) => tx('readwrite', (s) => s.delete(k))));
}

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** Downscale an image file to max 900px and return a JPEG data URL. */
export function fileToCompressedDataUrl(file: File, maxSide = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    if (file.size > MAX_PHOTO_BYTES) return reject(new Error('Image is too large (max 12 MB).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Could not process image.'));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}
