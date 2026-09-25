import type { Clock } from '../foundation/ports';

/** Starts at `start` and advances `stepMs` on every call, so runs are reproducible. */
export function fixedClock(start = '2026-01-01T09:00:00.000Z', stepMs = 1000): Clock {
  let time = Date.parse(start);
  return {
    now: () => {
      const current = new Date(time);
      time += stepMs;
      return current;
    },
  };
}
