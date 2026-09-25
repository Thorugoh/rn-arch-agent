import { z } from 'zod';
import { ActionError } from '../foundation/action-error';
import { findEntryToUndo, isUndoable, markUndone } from '../journal/journal';
import type { JournalEntry } from '../journal/journal-entry';
import { defineSystemAction } from './define-system-action';

const JournalItem = z.object({
  id: z.string(),
  at: z.string(),
  action: z.string(),
  origin: z.string(),
  summary: z.string(),
  undoable: z.boolean(),
  undone: z.boolean(),
});

const listJournal = defineSystemAction({
  name: 'journal.list',
  description: 'Recent changes, newest first: what changed, who changed it and whether it can be undone.',
  risk: 'read',
  input: z.object({ limit: z.number().int().min(1).max(200).default(20) }),
  output: z.array(JournalItem),
  handler: ({ input, context }) =>
    context
      .state()
      .journal.slice(0, input.limit)
      .map((entry) => ({
        id: entry.id,
        at: entry.at,
        action: entry.action,
        origin: entry.origin,
        summary: entry.summary,
        undoable: isUndoable(entry),
        undone: Boolean(entry.undoneBy),
      })),
});

const undo = defineSystemAction({
  name: 'journal.undo',
  description: 'Undo a change from the journal. Without entryId, undoes the most recent change that can be undone.',
  risk: 'write',
  input: z.object({ entryId: z.string().min(1).optional() }),
  output: z.object({ undone: z.string(), summary: z.string() }),
  handler: ({ input, context }) => {
    const entry = findEntryToUndo(context.state().journal, input.entryId);
    assertCanUndo(entry, input.entryId);
    try {
      context.replay(entry.undo!);
    } catch (error) {
      if (!(error instanceof ActionError)) throw error;
      throw new ActionError('conflict', `Cannot undo "${entry.summary}": ${error.message}`, { cause: error.code });
    }
    context.setState((state) => ({ ...state, journal: markUndone(state.journal, entry.id, context.entryId) }));
    return { undone: entry.id, summary: entry.summary };
  },
  summarize: ({ output }) => `undid: ${output.summary}`,
});

function assertCanUndo(entry: JournalEntry | undefined, requestedId?: string): asserts entry is JournalEntry {
  if (!entry) throw new ActionError('not_found', requestedId ? `No journal entry "${requestedId}"` : 'Nothing to undo');
  if (!entry.undo) throw new ActionError('conflict', `"${entry.summary}" cannot be undone`);
  if (entry.undoneBy) throw new ActionError('conflict', `"${entry.summary}" was already undone`);
}

export const journalActions = [listJournal, undo];
