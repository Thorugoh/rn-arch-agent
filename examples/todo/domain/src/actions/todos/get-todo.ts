import { z } from 'zod';
import { defineAction } from '../../kit';
import { TodoSchema } from '../../model/todo';
import { findTodo } from '../../queries/find';

export const getTodo = defineAction({
  name: 'todo.get',
  description: 'Get one todo by id.',
  risk: 'read',
  input: z.object({ id: z.string().min(1) }),
  output: TodoSchema,
  handler: ({ input, context }) => findTodo(context.data(), input.id),
});
