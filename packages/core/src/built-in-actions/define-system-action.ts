import type { z } from 'zod';
import type { ActionDefinition } from '../actions/define-action';
import type { SystemContext } from '../runtime/system-context';

/** Built-in actions work on the whole runtime state (navigation, journal), not only app data. */
export function defineSystemAction<TInput extends z.ZodType, TOutput extends z.ZodType>(
  definition: ActionDefinition<unknown, TInput, TOutput, SystemContext>,
) {
  return definition;
}
