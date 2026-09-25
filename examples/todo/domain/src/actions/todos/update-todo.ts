import { z } from 'zod';
import { defineAction } from '../../kit';
import { DueDateSchema, TodoSchema, TodoTitleSchema } from '../../model/todo';
import { findTodo } from '../../queries/find';
import { saveTodo } from './save-todo';

export const updateTodo = defineAction({
  name: 'todo.update',
  description: 'Rename a todo and/or change its due date (null clears the due date).',
  risk: 'write',
  input: z
    .object({ id: z.string().min(1), title: TodoTitleSchema.optional(), due: DueDateSchema.optional() })
    .refine((input) => input.title !== undefined || input.due !== undefined, 'Provide at least one of: title, due'),
  output: TodoSchema,
  handler: ({ input, context }) => {
    const current = findTodo(context.data(), input.id);
    const updated = {
      ...current,
      title: input.title ?? current.title,
      due: input.due === undefined ? current.due : input.due,
      updatedAt: context.now(),
    };
    context.setData(saveTodo(updated));
    return updated;
  },
  summarize: ({ input, output, before }) => {
    const previousTitle = before.todos[input.id]?.title;
    return input.title !== undefined && input.title !== previousTitle
      ? `renamed "${previousTitle}" to "${output.title}"`
      : `changed the due date of "${output.title}"`;
  },
  undo: ({ input, before }) => {
    const previous = before.todos[input.id]!;
    return { name: 'todo.update', input: { id: previous.id, title: previous.title, due: previous.due } };
  },
});
