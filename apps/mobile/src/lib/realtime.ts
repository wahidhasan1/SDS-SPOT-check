import { useEffect, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@fluentpath/shared';
import { getToken } from './api';
import { WS_URL } from './config';

type Listener = (m: ServerMessage) => void;
export type RtStatus = 'idle' | 'connecting' | 'open' | 'closed';

/** Shared WebSocket to the signaling server, authenticated with the session token. */
class Realtime {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(s: RtStatus) => void>();
  private retry = 0;
  private wanted = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  status: RtStatus = 'idle';
  generation = 0;

  connect() {
    this.wanted = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    const token = getToken();
    if (!token) return;
    this.set('connecting');
    // React Native's WebSocket accepts headers; we also send an auth message as a fallback.
    const Ws = WebSocket as unknown as new (url: string, protocols?: string[] | null, opts?: { headers: Record<string, string> }) => WebSocket;
    const ws = new Ws(WS_URL, null, { headers: { authorization: `Bearer ${token}` } });
    this.ws = ws;
    ws.onmessage = (e) => {
      let m: ServerMessage;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.type === 'ready') {
        this.retry = 0;
        this.generation++;
        this.set('open');
      }
      this.listeners.forEach((l) => l(m));
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.set('closed');
      if (this.wanted) this.timer = setTimeout(() => this.connect(), Math.min(10000, 1000 * 2 ** this.retry++));
    };
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
  onStatus(l: (s: RtStatus) => void) {
    this.statusListeners.add(l);
    return () => void this.statusListeners.delete(l);
  }
  private set(s: RtStatus) {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }
}

export const realtime = new Realtime();

export function useRealtimeStatus() {
  const [s, setS] = useState<RtStatus>(realtime.status);
  useEffect(() => {
    realtime.connect();
    return realtime.onStatus(setS);
  }, []);
  return s;
}
