import type { Storage } from '../foundation/ports';

/**
 * Upgrades stored state from older shapes as it loads, so apps can change their data model
 * without losing users' data. `migrate` gets whatever was stored and returns the current shape.
 */
export function withMigration(storage: Storage, migrate: (stored: unknown) => unknown): Storage {
  return {
    load: async () => {
      const stored = await storage.load();
      return stored == null ? stored : migrate(stored);
    },
    save: (state) => storage.save(state),
  };
}
