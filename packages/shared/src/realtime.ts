import type { ClientMessage, ServerMessage } from './types';

type Listener = (msg: ServerMessage) => void;
export type RealtimeState = 'disconnected' | 'connecting' | 'authenticating' | 'ready';

/**
 * Authenticated WebSocket with automatic reconnection.
 * Works in browsers and React Native (both provide a global WebSocket).
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<(s: RealtimeState) => void>();
  private queue: ClientMessage[] = [];
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;
  state: RealtimeState = 'disconnected';

  constructor(
    private url: string,
    private getToken: () => Promise<string | null>,
    private refresh: () => Promise<boolean>,
  ) {}

  private setState(s: RealtimeState) {
    this.state = s;
    this.stateListeners.forEach((l) => l(s));
  }

  onState(l: (s: RealtimeState) => void) {
    this.stateListeners.add(l);
    return () => this.stateListeners.delete(l);
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  connect() {
    this.closedByUser = false;
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.setState('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = async () => {
      this.setState('authenticating');
      const token = await this.getToken();
      if (!token) {
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ t: 'auth', token }));
    };
    ws.onmessage = async (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.t === 'auth.ok') {
        this.retry = 0;
        this.setState('ready');
        const pending = this.queue.splice(0);
        pending.forEach((m) => ws.send(JSON.stringify(m)));
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.send({ t: 'ping' }), 20_000);
      } else if (msg.t === 'auth.error') {
        // Access token probably expired: refresh once, then reconnect.
        await this.refresh();
      }
      this.listeners.forEach((l) => l(msg));
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.ws = null;
      this.setState('disconnected');
      if (!this.closedByUser) this.scheduleReconnect();
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private scheduleReconnect() {
    if (this.timer) return;
    const delay = Math.min(15_000, 500 * 2 ** this.retry) + Math.random() * 300;
    this.retry++;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, delay);
  }

  /** Sends now if authenticated; otherwise queues until the socket is ready. */
  send(msg: ClientMessage) {
    if (this.ws && this.state === 'ready') this.ws.send(JSON.stringify(msg));
    else if (msg.t !== 'ping') {
      this.queue.push(msg);
      this.connect();
    }
  }

  close() {
    this.closedByUser = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.ws?.close();
  }
}
