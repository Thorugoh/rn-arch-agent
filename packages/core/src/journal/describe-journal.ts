import { describeOrigin, isAgentOrigin } from '../foundation/origin';
import type { JournalEntry } from './journal-entry';
import { isUndoable } from './journal';

/** Ready-to-render activity feed ("Claude added "Buy milk"" + Undo). Use it in an Activity screen. */
export type ActivityItem = {
  id: string;
  at: string;
  origin: string;
  byAgent: boolean;
  text: string;
  undoable: boolean;
  undone: boolean;
};

export function describeJournal(journal: JournalEntry[]): ActivityItem[] {
  return journal.map((entry) => ({
    id: entry.id,
    at: entry.at,
    origin: entry.origin,
    byAgent: isAgentOrigin(entry.origin),
    text: `${describeOrigin(entry.origin)} ${entry.summary}`,
    undoable: isUndoable(entry),
    undone: Boolean(entry.undoneBy),
  }));
}
