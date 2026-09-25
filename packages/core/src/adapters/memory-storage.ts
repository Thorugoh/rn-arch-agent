import type { Storage } from '../foundation/ports';

/** Keeps state in memory. For tests, fixtures and ephemeral runs. */
export function memoryStorage(initial: unknown = null): Storage & { current(): unknown } {
  let stored = initial === null ? null : structuredClone(initial);
  return {
    load: async () => (stored === null ? null : structuredClone(stored)),
    save: async (state) => {
      stored = structuredClone(state);
    },
    current: () => stored,
  };
}
