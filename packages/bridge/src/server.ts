import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CLOSE_UNAUTHORIZED,
  DEFAULT_RELAY_PORT,
  ErrorCodes,
  isRequest,
  isResponse,
  parseMessage,
  type BridgeEvent,
  type DeviceInfo,
  type RpcId,
  type RpcRequest,
} from './protocol';

export type RelayLogEvent =
  | { type: 'device'; status: 'connected' | 'disconnected'; device: DeviceInfo }
  | { type: 'client'; status: 'connected' | 'disconnected' }
  | { type: 'rejected'; reason: string }
  | { type: 'call'; device: string; method: string; params: unknown }
  | { type: 'event'; event: BridgeEvent };

export type RelayOptions = {
  port?: number;
  /** Defaults to 127.0.0.1: only this machine (and the iOS simulator) can connect. */
  host?: string;
  /** Required from every connection when set. Set it whenever host isn't loopback. */
  token?: string;
  /** How long a forwarded call may wait for the app (confirmation sheets need a human). */
  callTimeoutMs?: number;
  log?: (e: RelayLogEvent) => void;
};

type Device = DeviceInfo & { socket: WebSocket };
type Client = { socket: WebSocket; target?: string; subscribed: boolean };
type Pending = { client: Client; clientId: RpcId; device: string; timer: ReturnType<typeof setTimeout> };

export async function startRelay(opts: RelayOptions = {}) {
  const host = opts.host ?? '127.0.0.1';
  const devices = new Map<string, Device>();
  const clients = new Set<Client>();
  const pending = new Map<string, Pending>();
  let seq = 0;
  const log = opts.log ?? (() => {});
  const now = () => new Date().toISOString();

  const wss = new WebSocketServer({ port: opts.port ?? DEFAULT_RELAY_PORT, host });
  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve);
    wss.once('error', reject);
  });

  const send = (socket: WebSocket, msg: object) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  };
  const replyError = (client: Client, id: RpcId, code: number, message: string, data?: unknown) =>
    send(client.socket, { jsonrpc: '2.0', id, error: { code, message, data } });

  function broadcast(event: BridgeEvent) {
    log({ type: 'event', event });
    for (const c of clients) {
      if (c.subscribed && (!c.target || event.device.startsWith(c.target))) {
        send(c.socket, { jsonrpc: '2.0', method: 'event', params: event });
      }
    }
  }

  /** Exact name, else a unique prefix ("ios" matches "ios-sim"), else the only device. */
  function resolveDevice(target?: string): Device | { error: string; code: number } {
    const all = [...devices.values()];
    if (!all.length) {
      return { code: ErrorCodes.NoDevice, error: 'No app is connected. Start the app in dev mode (npm run ios) and check it can reach the relay.' };
    }
    if (!target) {
      if (all.length === 1) return all[0]!;
      return { code: ErrorCodes.AmbiguousDevice, error: `Several apps are connected (${all.map((d) => d.name).join(', ')}). Pick one with --remote <name>.` };
    }
    const exact = devices.get(target);
    if (exact) return exact;
    const matches = all.filter((d) => d.name.startsWith(target));
    if (matches.length === 1) return matches[0]!;
    return {
      code: matches.length ? ErrorCodes.AmbiguousDevice : ErrorCodes.NoDevice,
      error: `No single app matches "${target}". Connected: ${all.map((d) => d.name).join(', ')}`,
    };
  }

  function onClientRequest(client: Client, req: RpcRequest) {
    if (req.method === 'relay.devices') {
      const list = [...devices.values()].map(({ socket: _s, ...info }) => info);
      return send(client.socket, { jsonrpc: '2.0', id: req.id, result: list });
    }
    if (req.method === 'events.subscribe') {
      client.subscribed = true;
      return send(client.socket, { jsonrpc: '2.0', id: req.id, result: { subscribed: true } });
    }
    const device = resolveDevice(client.target);
    if ('error' in device) return replyError(client, req.id, device.code, device.error);

    const relayId = `r${++seq}`;
    const timer = setTimeout(() => {
      pending.delete(relayId);
      replyError(client, req.id, ErrorCodes.Timeout, `${device.name} did not answer ${req.method} in time`);
    }, opts.callTimeoutMs ?? 120_000);
    pending.set(relayId, { client, clientId: req.id, device: device.name, timer });
    log({ type: 'call', device: device.name, method: req.method, params: req.params });
    send(device.socket, { ...req, id: relayId });
  }

  function onDeviceMessage(device: Device, data: unknown) {
    const msg = parseMessage(data);
    if (!msg) return;
    if (isResponse(msg)) {
      const p = pending.get(String(msg.id));
      if (!p) return;
      pending.delete(String(msg.id));
      clearTimeout(p.timer);
      send(p.client.socket, { ...msg, id: p.clientId });
    } else if ('method' in msg && msg.method === 'event') {
      broadcast({ ...(msg.params as BridgeEvent), device: device.name });
    }
  }

  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '/', 'ws://relay');
    const q = url.searchParams;
    if (opts.token && q.get('token') !== opts.token) {
      log({ type: 'rejected', reason: 'bad or missing token' });
      socket.close(CLOSE_UNAUTHORIZED, 'Bad or missing pairing token');
      return;
    }

    if (q.get('role') === 'app') {
      const name = q.get('name') || `app-${devices.size + 1}`;
      devices.get(name)?.socket.close(1000, 'Replaced by a newer connection');
      const device: Device = { name, platform: q.get('platform') ?? 'unknown', connectedAt: now(), socket };
      devices.set(name, device);
      log({ type: 'device', status: 'connected', device });
      broadcast({ type: 'device', device: name, at: now(), status: 'connected' });
      socket.on('message', (data) => onDeviceMessage(device, data));
      socket.on('close', () => {
        if (devices.get(name) !== device) return;
        devices.delete(name);
        for (const [id, p] of pending) {
          if (p.device !== name) continue;
          clearTimeout(p.timer);
          pending.delete(id);
          replyError(p.client, p.clientId, ErrorCodes.DeviceGone, `${name} disconnected`);
        }
        log({ type: 'device', status: 'disconnected', device });
        broadcast({ type: 'device', device: name, at: now(), status: 'disconnected' });
      });
      return;
    }

    const client: Client = { socket, target: q.get('target') || undefined, subscribed: false };
    clients.add(client);
    log({ type: 'client', status: 'connected' });
    socket.on('message', (data) => {
      const msg = parseMessage(data);
      if (msg && isRequest(msg)) onClientRequest(client, msg);
    });
    socket.on('close', () => {
      clients.delete(client);
      for (const [id, p] of pending) {
        if (p.client === client) {
          clearTimeout(p.timer);
          pending.delete(id);
        }
      }
      log({ type: 'client', status: 'disconnected' });
    });
  });

  return {
    port: (wss.address() as AddressInfo).port,
    host,
    devices: () => [...devices.values()].map(({ socket: _s, ...info }) => info),
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of wss.clients) s.terminate();
        wss.close(() => resolve());
      }),
  };
}

export type Relay = Awaited<ReturnType<typeof startRelay>>;
