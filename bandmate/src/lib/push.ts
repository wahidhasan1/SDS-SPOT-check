import { del, post } from './api'

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function currentPushSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Asks the browser for permission and registers this device for push messages. */
export async function enablePush(vapidPublicKey: string) {
  if (!pushSupported()) throw new Error('This browser does not support push notifications.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser settings.')
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidPublicKey) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await post('/notifications/push', { endpoint: j.endpoint, keys: j.keys })
  return sub
}

export async function disablePush() {
  const sub = await currentPushSubscription()
  if (!sub) return
  await del('/notifications/push', { endpoint: sub.endpoint }).catch(() => undefined)
  await sub.unsubscribe()
}
