import { z } from 'zod';
import { FilterSchema } from './filter';
import { ListSchema } from './list';
import { TodoSchema } from './todo';

/** Everything the todo app stores (navigation and the journal are kept by the runtime). */
export const TodoDataSchema = z.object({
  lists: z.record(z.string(), ListSchema),
  todos: z.record(z.string(), TodoSchema),
  filter: FilterSchema,
});
export type TodoData = z.infer<typeof TodoDataSchema>;
