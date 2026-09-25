import { JOURNAL_LIMIT, type JournalEntry } from './journal-entry';

/** The journal is newest-first. All functions are pure. */

export function addEntry(journal: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  return [entry, ...journal].slice(0, JOURNAL_LIMIT);
}

export function isUndoable(entry: JournalEntry): boolean {
  return Boolean(entry.undo) && !entry.undoneBy;
}

/** The given entry, or the most recent one that can still be undone. */
export function findEntryToUndo(journal: JournalEntry[], entryId?: string): JournalEntry | undefined {
  return entryId ? journal.find((entry) => entry.id === entryId) : journal.find(isUndoable);
}

export function markUndone(journal: JournalEntry[], entryId: string, undoneBy: string): JournalEntry[] {
  return journal.map((entry) => (entry.id === entryId ? { ...entry, undoneBy } : entry));
}
