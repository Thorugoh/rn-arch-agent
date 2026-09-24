import type { ActionInfo, DispatchMeta, DispatchResult, Inspection, Route } from '@todo/core';

/**
 * Remote mode: JSON-RPC 2.0 over WebSocket.
 *
 *   todo CLI / MCP ──(role=client)──►  relay (`todo serve`)  ◄──(role=app)── the running app (dev only)
 *
 * The app dials out to the relay, so no server socket is needed on the device. The relay
 * forwards client requests to the chosen app and streams the app's events back.
 */
export const DEFAULT_RELAY_PORT = 8765;
export const DEFAULT_RELAY_URL = `ws://127.0.0.1:${DEFAULT_RELAY_PORT}`;

export type RpcId = string | number;
export type RpcRequest = { jsonrpc: '2.0'; id: RpcId; method: string; params?: unknown };
export type RpcError = { code: number; message: string; data?: unknown };
export type RpcResponse = { jsonrpc: '2.0'; id: RpcId; result?: unknown; error?: RpcError };
export type RpcNotification = { jsonrpc: '2.0'; method: string; params?: unknown };
export type RpcMessage = RpcRequest | RpcResponse | RpcNotification;

export const ErrorCodes = {
  MethodNotFound: -32601,
  InvalidParams: -32602,
  Internal: -32603,
  NoDevice: -32001,
  AmbiguousDevice: -32002,
  DeviceGone: -32003,
  Timeout: -32004,
} as const;

/** WebSocket close code for a bad or missing pairing token. */
export const CLOSE_UNAUTHORIZED = 4001;

/** Methods served by the app. */
export type AppMethods = {
  'actions.list': { params: undefined; result: ActionInfo[] };
  'actions.invoke': { params: { name: string; input: unknown; meta: DispatchMeta }; result: DispatchResult };
  'app.inspect': { params: undefined; result: Inspection };
  'dev.screenshot': { params: undefined; result: { base64: string; format: 'png' } };
};

/** Methods served by the relay itself. */
export type RelayMethods = {
  'relay.devices': { params: undefined; result: DeviceInfo[] };
  'events.subscribe': { params: undefined; result: { subscribed: true } };
};

export type DeviceInfo = { name: string; platform: string; connectedAt: string };

/** Sent by the app right after connecting. */
export type HelloParams = { name: string; platform: string };

export type BridgeEvent =
  | {
      type: 'dispatch';
      device: string;
      at: string;
      name: string;
      origin: string;
      ok: boolean;
      code?: string;
      summary?: string;
    }
  | { type: 'nav'; device: string; at: string; route: Route }
  | { type: 'device'; device: string; at: string; status: 'connected' | 'disconnected' };

export function isRequest(m: RpcMessage): m is RpcRequest {
  return 'method' in m && 'id' in m && m.id !== undefined;
}

export function isResponse(m: RpcMessage): m is RpcResponse {
  return !('method' in m) && 'id' in m;
}

export function parseMessage(data: unknown): RpcMessage | null {
  try {
    const msg = JSON.parse(typeof data === 'string' ? data : String(data));
    return msg && typeof msg === 'object' && msg.jsonrpc === '2.0' ? (msg as RpcMessage) : null;
  } catch {
    return null;
  }
}
