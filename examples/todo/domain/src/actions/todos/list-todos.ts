import { z } from 'zod';
import { defineAction } from '../../kit';
import { FilterSchema } from '../../model/filter';
import { TodoSchema } from '../../model/todo';
import { findList } from '../../queries/find';
import { todosInList } from '../../queries/todos-in-list';

export const listTodos = defineAction({
  name: 'todo.list',
  description: 'List the todos in a list, optionally only open or done ones.',
  risk: 'read',
  input: z.object({ listId: z.string().min(1), filter: FilterSchema.default('all') }),
  output: z.array(TodoSchema),
  handler: ({ input, context }) => {
    findList(context.data(), input.listId);
    return todosInList(context.data(), input.listId, input.filter);
  },
});
