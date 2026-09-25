/** JSON-RPC 2.0 message shapes and parsing. */
export type RpcId = string | number;
export type RpcRequest = { jsonrpc: '2.0'; id: RpcId; method: string; params?: unknown };
export type RpcError = { code: number; message: string; data?: unknown };
export type RpcResponse = { jsonrpc: '2.0'; id: RpcId; result?: unknown; error?: RpcError };
export type RpcNotification = { jsonrpc: '2.0'; method: string; params?: unknown };
export type RpcMessage = RpcRequest | RpcResponse | RpcNotification;

export function isRequest(message: RpcMessage): message is RpcRequest {
  return 'method' in message && 'id' in message && message.id !== undefined;
}

export function isResponse(message: RpcMessage): message is RpcResponse {
  return !('method' in message) && 'id' in message;
}

export function isNotification(message: RpcMessage, method: string): message is RpcNotification {
  return 'method' in message && !('id' in message) && message.method === method;
}

export function parseMessage(data: unknown): RpcMessage | null {
  try {
    const message = JSON.parse(typeof data === 'string' ? data : String(data));
    return message && typeof message === 'object' && message.jsonrpc === '2.0' ? (message as RpcMessage) : null;
  } catch {
    return null;
  }
}

export function resultResponse(id: RpcId, result: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function errorResponse(id: RpcId, code: number, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}

export function notification(method: string, params: unknown): RpcNotification {
  return { jsonrpc: '2.0', method, params };
}
