import { useEffect, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@fluentpath/shared';

type Listener = (m: ServerMessage) => void;
export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'closed';

/** One shared WebSocket per tab, authenticated by the session cookie, with automatic reconnection. */
class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: RealtimeStatus) => void>();
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private wanted = false;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  status: RealtimeStatus = 'idle';
  /** Increments each time a new socket becomes ready (used to rejoin calls after a reconnect). */
  generation = 0;

  connect() {
    this.wanted = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.setStatus('connecting');
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onmessage = (e) => {
      let m: ServerMessage;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === 'ready') {
        this.retry = 0;
        this.generation++;
        this.setStatus('open');
      }
      this.listeners.forEach((l) => l(m));
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      this.setStatus('closed');
      if (this.ws === ws) this.ws = null;
      if (this.wanted) {
        const delay = Math.min(10_000, 1000 * 2 ** this.retry++);
        this.timer = setTimeout(() => this.connect(), delay);
      }
    };
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 20_000);
  }

  disconnect() {
    this.wanted = false;
    clearTimeout(this.timer);
    this.ws?.close();
  }

  send(m: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(m));
      return true;
    }
    return false;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  onStatus(l: (s: RealtimeStatus) => void) {
    this.statusListeners.add(l);
    return () => void this.statusListeners.delete(l);
  }

  private setStatus(s: RealtimeStatus) {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }
}

export const realtime = new RealtimeClient();

export function useRealtimeStatus() {
  const [s, setS] = useState<RealtimeStatus>(realtime.status);
  useEffect(() => {
    realtime.connect();
    return realtime.onStatus(setS);
  }, []);
  return s;
}

export function useRealtimeMessages(handler: Listener) {
  useEffect(() => realtime.subscribe(handler), [handler]);
}
