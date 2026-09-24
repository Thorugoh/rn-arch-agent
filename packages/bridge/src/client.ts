import type { ActionInfo, DispatchMeta, DispatchResult, Inspection } from '@todo/core';
import {
  CLOSE_UNAUTHORIZED,
  isResponse,
  parseMessage,
  type BridgeEvent,
  type DeviceInfo,
  type RpcError,
} from './protocol';

export class RemoteError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

export type RelayClientOptions = {
  /** Device name or prefix. Optional when exactly one app is connected. */
  target?: string;
  token?: string;
  /** Per-call timeout. Invokes default to 120s, since the app may be waiting on a human. */
  timeoutMs?: number;
};

/** Talks to a running app through the relay. Used by `todo --remote` and the MCP server. */
export async function connectRelay(url: string, opts: RelayClientOptions = {}) {
  const query = new URLSearchParams({ role: 'client' });
  if (opts.target) query.set('target', opts.target);
  if (opts.token) query.set('token', opts.token);
  const ws = new WebSocket(`${url}?${query}`);

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error(`Could not reach the relay at ${url}. Start it with: todo serve`));
  });

  let seq = 0;
  const waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const listeners = new Set<(e: BridgeEvent) => void>();
  let closedReason: string | undefined;

  ws.onmessage = (ev) => {
    const msg = parseMessage(ev.data);
    if (!msg) return;
    if (isResponse(msg)) {
      const w = waiting.get(Number(msg.id));
      if (!w) return;
      waiting.delete(Number(msg.id));
      clearTimeout(w.timer);
      if (msg.error) w.reject(new RemoteError(msg.error.code, msg.error.message, (msg.error as RpcError).data));
      else w.resolve(msg.result);
    } else if ('method' in msg && msg.method === 'event') {
      listeners.forEach((l) => l(msg.params as BridgeEvent));
    }
  };
  ws.onclose = (ev) => {
    closedReason = ev.code === CLOSE_UNAUTHORIZED ? 'The relay rejected the pairing token (--token)' : 'Relay connection closed';
    for (const w of waiting.values()) {
      clearTimeout(w.timer);
      w.reject(new Error(closedReason));
    }
    waiting.clear();
  };

  function call<T>(method: string, params?: unknown, timeoutMs = opts.timeoutMs ?? 15_000): Promise<T> {
    if (closedReason) return Promise.reject(new Error(closedReason));
    const id = ++seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(new RemoteError(-32004, `No answer to ${method} after ${timeoutMs}ms`));
      }, timeoutMs);
      waiting.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  return {
    call,
    dispatch: (name: string, input: unknown, meta: DispatchMeta) =>
      call<DispatchResult>('actions.invoke', { name, input, meta }, opts.timeoutMs ?? 120_000),
    describe: () => call<ActionInfo[]>('actions.list'),
    inspect: () => call<Inspection>('app.inspect'),
    screenshot: () => call<{ base64: string; format: 'png' }>('dev.screenshot', undefined, 30_000),
    devices: () => call<DeviceInfo[]>('relay.devices'),
    async subscribe(listener: (e: BridgeEvent) => void) {
      listeners.add(listener);
      await call('events.subscribe');
      return () => void listeners.delete(listener);
    },
    close: () => ws.close(),
  };
}

export type RelayClient = Awaited<ReturnType<typeof connectRelay>>;
