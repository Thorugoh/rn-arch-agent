import { z } from 'zod';
import { Filter, Id, IsoDate, List, Origin, Todo } from './domain';
import { NavState, initialNav } from './nav';

export const Invocation = z.object({ name: z.string(), input: z.unknown() });
export type Invocation = z.infer<typeof Invocation>;

export const JournalEntry = z.object({
  id: Id,
  at: IsoDate,
  action: z.string(),
  input: z.unknown(),
  origin: Origin,
  summary: z.string(),
  inverse: Invocation.optional(),
  undoneBy: Id.optional(),
});
export type JournalEntry = z.infer<typeof JournalEntry>;

export const AppState = z.object({
  lists: z.record(z.string(), List),
  todos: z.record(z.string(), Todo),
  nav: NavState,
  ui: z.object({ filter: Filter }),
  /** Newest first. Every write/destructive dispatch lands here with its origin. */
  journal: z.array(JournalEntry),
});
export type AppState = z.infer<typeof AppState>;

export const JOURNAL_LIMIT = 200;

export const emptyState = (): AppState => ({
  lists: {},
  todos: {},
  nav: initialNav(),
  ui: { filter: 'all' },
  journal: [],
});
