import type { AppState } from './state';
import type { Clock, IdGen, Storage } from './ports';

/** Platform-free port implementations for tests, fixtures and ephemeral runs. */

export function memoryStorage(initial: AppState | null = null): Storage & { current(): AppState | null } {
  let data: AppState | null = initial ? structuredClone(initial) : null;
  return {
    load: async () => (data ? structuredClone(data) : null),
    save: async (s) => {
      data = structuredClone(s);
    },
    current: () => data,
  };
}

/** Starts at `start` and advances `stepMs` on every call, so runs are reproducible. */
export function fixedClock(start = '2026-01-01T09:00:00.000Z', stepMs = 1000): Clock {
  let t = Date.parse(start);
  return {
    now: () => {
      const d = new Date(t);
      t += stepMs;
      return d;
    },
  };
}

export function seqIds(): IdGen {
  const counters = new Map<string, number>();
  return {
    next: (prefix) => {
      const n = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, n);
      return `${prefix}${n}`;
    },
  };
}
