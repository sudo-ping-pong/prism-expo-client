import type { PrismEnvelope, PrismHandshakeAck } from '@sudo-ping-pong/prism-protocol';
import { isPrismCommand } from '@sudo-ping-pong/prism-protocol';
import { EventBuffer } from './buffer';
import { handlePrismCommand } from './command-handler';

export interface TransportOptions {
  host: string;
  port: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: PrismTransportError) => void;
}

export type PrismTransportError =
  | { type: 'auth'; message: string }
  | { type: 'network'; message: string }
  | { type: 'unavailable'; message: string };

type WebSocketLike = {
  send(data: string): void;
  close(): void;
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
};

const WS_OPEN = 1;
const MAX_BACKOFF_MS = 30_000;

export class PrismTransport {
  private ws: WebSocketLike | null = null;
  private readonly buffer = new EventBuffer();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: TransportOptions;
  private connected = false;
  private destroyed = false;
  private authFailed = false;
  private reconnectAttempts = 0;

  constructor(options: TransportOptions) {
    this.options = options;
  }

  connect(): void {
    if (this.destroyed || this.authFailed) return;

    const url = `ws://${this.options.host}:${this.options.port}`;
    const WS = getWebSocketConstructor();
    if (!WS) {
      this.options.onError?.({
        type: 'unavailable',
        message: 'WebSocket is not available in this environment',
      });
      return;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    this.ws = new WS(url) as WebSocketLike;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.ws?.send(
        JSON.stringify({
          type: 'handshake',
          role: 'sdk',
        }),
      );
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as PrismHandshakeAck | unknown;

        if (
          typeof msg === 'object' &&
          msg !== null &&
          'type' in msg &&
          (msg as PrismHandshakeAck).type === 'handshake_ack'
        ) {
          const ack = msg as PrismHandshakeAck;
          if (ack.success) {
            this.connected = true;
            this.options.onConnect?.();
            this.flushBuffer();
          } else {
            this.authFailed = true;
            const message = ack.message ?? 'Handshake rejected by server';
            this.options.onError?.({ type: 'auth', message });
            this.ws?.close();
          }
          return;
        }

        if (this.connected && isPrismCommand(msg)) {
          handlePrismCommand(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;

      if (this.destroyed || this.authFailed) return;

      this.options.onDisconnect?.();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.connected = false;
      this.options.onError?.({
        type: 'network',
        message: `Cannot reach Prism server at ${this.options.host}:${this.options.port}`,
      });
    };
  }

  send(envelope: PrismEnvelope): void {
    queueMicrotask(() => {
      if (this.connected && this.ws?.readyState === WS_OPEN) {
        try {
          this.ws.send(JSON.stringify(envelope));
        } catch {
          this.buffer.push(envelope);
        }
      } else {
        this.buffer.push(envelope);
      }
    });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  resetAuthFailure(): void {
    this.authFailed = false;
    this.destroyed = false;
    this.reconnectAttempts = 0;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get hasAuthFailed(): boolean {
    return this.authFailed;
  }

  private flushBuffer(): void {
    const pending = this.buffer.drain();
    for (const envelope of pending) {
      this.send(envelope);
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.authFailed || this.reconnectTimer) return;

    const delay = Math.min(3000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

function getWebSocketConstructor(): (new (url: string) => WebSocketLike) | null {
  if (typeof globalThis.WebSocket !== 'undefined') {
    return globalThis.WebSocket as unknown as new (url: string) => WebSocketLike;
  }
  return null;
}
