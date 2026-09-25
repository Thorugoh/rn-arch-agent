import { z } from 'zod';
import { JournalEntrySchema, type JournalEntry } from '../journal/journal-entry';
import type { NavigationStack } from '../navigation/navigation-stack';
import type { AnyRoute } from '../navigation/route';

/**
 * Everything the runtime persists. `data` belongs to the app; `navigation` and `journal` are
 * managed by the runtime so every app gets navigation-as-state and undo for free.
 */
export type RuntimeState<TData = unknown, TRoute extends AnyRoute = AnyRoute> = {
  data: TData;
  navigation: NavigationStack<TRoute>;
  journal: JournalEntry[];
};

export function runtimeStateSchema(dataSchema: z.ZodType, routeSchema: z.ZodType) {
  return z.object({
    data: dataSchema,
    navigation: z.object({ stack: z.array(routeSchema).min(1) }),
    journal: z.array(JournalEntrySchema),
  });
}
