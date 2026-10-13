// One authenticated WebSocket per tab, shared by calls, battles and live notifications.
// Reconnects automatically with backoff; listeners survive reconnects.

export type WsMessage = { t: string; [k: string]: unknown }
type Listener = (m: WsMessage) => void
export type WsStatus = 'connecting' | 'open' | 'closed'

class Socket {
  private ws: WebSocket | null = null
  private listeners = new Map<string, Set<Listener>>()
  private statusListeners = new Set<(s: WsStatus) => void>()
  private retry = 0
  private wanted = false
  private queue: WsMessage[] = []
  private pingTimer: number | undefined
  status: WsStatus = 'closed'
  clientId: string | null = null

  connect() {
    this.wanted = true
    if (this.ws && this.ws.readyState <= 1) return
    this.setStatus('connecting')
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
    this.ws = ws
    ws.onopen = () => {
      this.retry = 0
      this.setStatus('open')
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m))
      window.clearInterval(this.pingTimer)
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 20_000)
    }
    ws.onmessage = (ev) => {
      let m: WsMessage
      try {
        m = JSON.parse(ev.data)
      } catch {
        return
      }
      if (m.t === 'hello') this.clientId = String(m.clientId)
      this.listeners.get(m.t)?.forEach((l) => l(m))
      this.listeners.get('*')?.forEach((l) => l(m))
    }
    ws.onclose = (ev) => {
      window.clearInterval(this.pingTimer)
      this.ws = null
      this.clientId = null
      this.setStatus('closed')
      if (ev.code === 4401) this.wanted = false
      if (this.wanted) {
        const delay = Math.min(10_000, 500 * 2 ** this.retry++) + Math.random() * 300
        window.setTimeout(() => this.wanted && this.connect(), delay)
      }
    }
  }

  disconnect() {
    this.wanted = false
    this.ws?.close()
  }

  /** Simulates a network drop (used by the call screen's "reconnect" path and by tests). */
  drop() {
    this.ws?.close()
  }

  send(m: WsMessage) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m))
    else if (m.t !== 'ping') this.queue.push(m)
  }

  on(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
    return () => void this.listeners.get(type)?.delete(fn)
  }

  onStatus(fn: (s: WsStatus) => void) {
    this.statusListeners.add(fn)
    return () => void this.statusListeners.delete(fn)
  }

  /** Waits until the socket is open (or rejects after `ms`). */
  ready(ms = 8000) {
    if (this.status === 'open') return Promise.resolve()
    this.connect()
    return new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => {
        off()
        reject(new Error('Could not reach the server. Check your connection.'))
      }, ms)
      const off = this.onStatus((s) => {
        if (s === 'open') {
          window.clearTimeout(t)
          off()
          resolve()
        }
      })
    })
  }

  private setStatus(s: WsStatus) {
    this.status = s
    this.statusListeners.forEach((l) => l(s))
  }
}

export const socket = new Socket()
