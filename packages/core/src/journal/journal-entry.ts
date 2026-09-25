import { z } from 'zod';
import { OriginSchema } from '../foundation/origin';

/** A call to an action by name. Used to store how to undo an entry. */
export const InvocationSchema = z.object({ name: z.string(), input: z.unknown() });
export type Invocation = z.infer<typeof InvocationSchema>;

/** One change to the app's data: what, who, and how to undo it. */
export const JournalEntrySchema = z.object({
  id: z.string().min(1),
  at: z.iso.datetime(),
  action: z.string(),
  input: z.unknown(),
  origin: OriginSchema,
  summary: z.string(),
  undo: InvocationSchema.optional(),
  undoneBy: z.string().optional(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const JOURNAL_LIMIT = 200;
