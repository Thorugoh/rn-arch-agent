import { z } from 'zod';
import type { Storage } from '../foundation/ports';
import type { RuntimeState } from './runtime-state';
import type { StateStore } from './state-store';

/** Loads and validates the stored state, or creates a fresh one when storage is empty. */
export async function loadState(args: {
  storage: Storage;
  schema: z.ZodType;
  createFresh: () => RuntimeState;
}): Promise<{ state: RuntimeState; isNew: boolean }> {
  const stored = await args.storage.load();
  if (stored == null) return { state: args.createFresh(), isNew: true };
  const parsed = args.schema.safeParse(stored);
  if (!parsed.success) throw new Error(`Stored state is invalid:\n${z.prettifyError(parsed.error)}`);
  return { state: parsed.data as RuntimeState, isNew: false };
}

/** Saves every change, in order. `flush()` resolves once everything so far is saved. */
export function persistChanges(store: StateStore, storage: Storage, { saveNow }: { saveNow: boolean }) {
  let saving: Promise<void> = saveNow ? storage.save(store.get()) : Promise.resolve();
  store.subscribe((state) => {
    saving = saving.then(() => storage.save(state));
  });
  return { flush: () => saving };
}
