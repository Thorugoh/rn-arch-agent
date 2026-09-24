import { currentRoute, type App } from '@todo/core';
import { ErrorCodes, isRequest, parseMessage, type BridgeEvent, type RpcRequest, type RpcResponse } from './protocol';

export type BridgeStatus = 'connecting' | 'open' | 'closed';

export type AppBridgeOptions = {
  /** Relay URL, e.g. ws://127.0.0.1:8765 (iOS simulator) or ws://10.0.2.2:8765 (Android emulator). */
  url: string;
  name: string;
  platform: string;
  token?: string;
  /** Returns a base64 PNG of the screen, if the platform can take one. */
  screenshot?: () => Promise<string>;
  reconnectMs?: number;
  onStatus?: (status: BridgeStatus) => void;
};

/**
 * Runs inside the app (dev builds only). Dials out to the relay and serves the app's
 * capability surface: the same actions the UI uses, so remote runs are real runs.
 */
export function startAppBridge(app: App, opts: AppBridgeOptions) {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const now = () => new Date().toISOString();

  const send = (msg: object) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const emit = (event: BridgeEvent) => send({ jsonrpc: '2.0', method: 'event', params: event });

  async function handle(req: RpcRequest): Promise<RpcResponse> {
    const reply = (result: unknown): RpcResponse => ({ jsonrpc: '2.0', id: req.id, result });
    const fail = (code: number, message: string): RpcResponse => ({ jsonrpc: '2.0', id: req.id, error: { code, message } });
    try {
      switch (req.method) {
        case 'actions.list':
          return reply(app.describe());
        case 'actions.invoke': {
          const p = req.params as { name?: string; input?: unknown; meta?: { origin?: string } } | undefined;
          if (!p?.name || !p.meta?.origin) return fail(ErrorCodes.InvalidParams, 'actions.invoke needs { name, input, meta: { origin } }');
          return reply(await app.dispatch(p.name, p.input, p.meta as Parameters<App['dispatch']>[2]));
        }
        case 'app.inspect':
          return reply(app.inspect());
        case 'dev.screenshot':
          if (!opts.screenshot) return fail(ErrorCodes.MethodNotFound, 'This app cannot take screenshots');
          return reply({ base64: await opts.screenshot(), format: 'png' });
        default:
          return fail(ErrorCodes.MethodNotFound, `Unknown method "${req.method}"`);
      }
    } catch (e) {
      return fail(ErrorCodes.Internal, e instanceof Error ? e.message : String(e));
    }
  }

  function connect() {
    if (stopped) return;
    opts.onStatus?.('connecting');
    const query = new URLSearchParams({ role: 'app', name: opts.name, platform: opts.platform });
    if (opts.token) query.set('token', opts.token);
    const socket = new WebSocket(`${opts.url}?${query}`);
    ws = socket;
    socket.onopen = () => {
      opts.onStatus?.('open');
      send({ jsonrpc: '2.0', method: 'app.hello', params: { name: opts.name, platform: opts.platform } });
    };
    socket.onmessage = (ev) => {
      const msg = parseMessage(ev.data);
      if (msg && isRequest(msg)) void handle(msg).then(send);
    };
    socket.onclose = () => {
      if (ws === socket) ws = null;
      opts.onStatus?.('closed');
      if (!stopped) retry = setTimeout(connect, opts.reconnectMs ?? 2000);
    };
    socket.onerror = () => {
      // onclose follows; reconnect happens there. The relay is optional, so stay quiet.
    };
  }

  const offDispatch = app.onDispatch((e) =>
    emit({
      type: 'dispatch',
      device: opts.name,
      at: now(),
      name: e.name,
      origin: e.meta.origin,
      ok: e.result.ok,
      code: e.result.ok ? undefined : e.result.error.code,
      summary: e.summary,
    }),
  );
  const offNav = app.subscribe((s, prev) => {
    if (s.nav !== prev.nav) emit({ type: 'nav', device: opts.name, at: now(), route: currentRoute(s.nav) });
  });

  connect();

  return {
    stop() {
      stopped = true;
      clearTimeout(retry);
      offDispatch();
      offNav();
      ws?.close();
    },
  };
}
