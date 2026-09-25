import { z } from 'zod';
import { defineAction } from '../../kit';
import { TodoSchema } from '../../model/todo';
import { findTodo } from '../../queries/find';
import { removeTodo } from './save-todo';

export const deleteTodo = defineAction({
  name: 'todo.delete',
  description: 'Delete a todo. Agents need the user to confirm. Can be undone from the Activity screen.',
  risk: 'destructive',
  input: z.object({ id: z.string().min(1) }),
  output: z.object({ deleted: TodoSchema }),
  handler: ({ input, context }) => {
    const todo = findTodo(context.data(), input.id);
    context.setData(removeTodo(todo.id));
    return { deleted: todo };
  },
  confirmText: ({ input, data }) => `Delete "${data.todos[input.id]?.title ?? input.id}"?`,
  summarize: ({ output }) => `deleted "${output.deleted.title}"`,
  undo: ({ output }) => ({ name: 'todo.restore', input: { todo: output.deleted } }),
});
