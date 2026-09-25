import type { IdGenerator } from '../foundation/ports';

/** "t_" → t_1, t_2, … Deterministic ids for tests. */
export function sequentialIds(): IdGenerator {
  const counters = new Map<string, number>();
  return {
    next: (prefix) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}${next}`;
    },
  };
}
