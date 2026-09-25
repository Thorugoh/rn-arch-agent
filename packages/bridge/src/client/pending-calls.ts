import { RpcErrorCodes } from '../protocol/bridge-protocol';
import type { RpcResponse } from '../protocol/json-rpc';
import { RemoteError } from './remote-error';

type Waiter = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

/** Tracks requests waiting for a response, with per-call timeouts. */
export function createPendingCalls() {
  let lastId = 0;
  const waiting = new Map<number, Waiter>();

  return {
    start(method: string, timeoutMs: number): { id: number; response: Promise<unknown> } {
      const id = ++lastId;
      const response = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new RemoteError(RpcErrorCodes.Timeout, `No answer to ${method} after ${timeoutMs}ms`));
        }, timeoutMs);
        waiting.set(id, { resolve, reject, timer });
      });
      return { id, response };
    },
    settle(message: RpcResponse) {
      const waiter = waiting.get(Number(message.id));
      if (!waiter) return;
      waiting.delete(Number(message.id));
      clearTimeout(waiter.timer);
      if (message.error) waiter.reject(new RemoteError(message.error.code, message.error.message, message.error.data));
      else waiter.resolve(message.result);
    },
    failAll(reason: string) {
      for (const waiter of waiting.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error(reason));
      }
      waiting.clear();
    },
  };
}
