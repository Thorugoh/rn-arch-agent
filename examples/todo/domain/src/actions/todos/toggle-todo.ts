import { z } from 'zod';
import { defineAction } from '../../kit';
import { TodoSchema } from '../../model/todo';
import { findTodo } from '../../queries/find';
import { saveTodo } from './save-todo';

export const toggleTodo = defineAction({
  name: 'todo.toggle',
  description: 'Mark a todo done or not done. Without `done`, flips the current status.',
  risk: 'write',
  input: z.object({ id: z.string().min(1), done: z.boolean().optional() }),
  output: TodoSchema,
  handler: ({ input, context }) => {
    const current = findTodo(context.data(), input.id);
    const updated = { ...current, done: input.done ?? !current.done, updatedAt: context.now() };
    context.setData(saveTodo(updated));
    return updated;
  },
  summarize: ({ output }) => `${output.done ? 'completed' : 'reopened'} "${output.title}"`,
  undo: ({ input, before }) => ({ name: 'todo.toggle', input: { id: input.id, done: before.todos[input.id]!.done } }),
});
