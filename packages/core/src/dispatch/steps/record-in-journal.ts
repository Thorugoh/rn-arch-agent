import type { AnyActionDefinition } from '../../actions/define-action';
import { addEntry } from '../../journal/journal';
import type { JournalEntry } from '../../journal/journal-entry';
import type { Origin } from '../../foundation/origin';
import type { StateStore } from '../../runtime/state-store';

/** Adds the journal entry for a successful write, with its summary and how to undo it. */
export function recordInJournal(args: {
  store: StateStore;
  action: AnyActionDefinition;
  entryId: string;
  at: string;
  origin: Origin;
  input: unknown;
  output: unknown;
  dataBefore: unknown;
}): JournalEntry {
  const { store, action, entryId, at, origin, input, output, dataBefore } = args;
  const entry: JournalEntry = {
    id: entryId,
    at,
    action: action.name,
    input,
    origin,
    summary: action.summarize?.({ input, output, before: dataBefore }) ?? action.name,
    undo: action.undo?.({ input, output, before: dataBefore }),
  };
  store.update((state) => ({ ...state, journal: addEntry(state.journal, entry) }));
  return entry;
}
