import type { DispatchMeta, DispatchResult } from './dispatch-types';

/** Remembers successful results per (origin, action, key), so agent retries don't run twice. */
export function createIdempotencyCache() {
  const results = new Map<string, DispatchResult>();
  const keyFor = (name: string, meta: DispatchMeta) =>
    meta.idempotencyKey ? `${meta.origin}:${name}:${meta.idempotencyKey}` : undefined;

  return {
    lookup(name: string, meta: DispatchMeta): DispatchResult | undefined {
      const key = keyFor(name, meta);
      return key ? results.get(key) : undefined;
    },
    remember(name: string, meta: DispatchMeta, result: DispatchResult) {
      const key = keyFor(name, meta);
      if (key && result.ok) results.set(key, result);
    },
  };
}
