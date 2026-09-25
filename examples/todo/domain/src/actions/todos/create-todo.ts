import { z } from 'zod';
import { defineAction } from '../../kit';
import { INBOX_ID } from '../../model/list';
import { DueDateSchema, TodoSchema, TodoTitleSchema, type Todo } from '../../model/todo';
import { findList } from '../../queries/find';
import { saveTodo } from './save-todo';

export const createTodo = defineAction({
  name: 'todo.create',
  description: 'Create a todo in a list (the Inbox by default). Returns the new todo.',
  risk: 'write',
  input: z.object({ listId: z.string().min(1).default(INBOX_ID), title: TodoTitleSchema, due: DueDateSchema.optional() }),
  output: TodoSchema,
  handler: ({ input, context }) => {
    findList(context.data(), input.listId);
    const now = context.now();
    const todo: Todo = {
      id: context.newId('t_'),
      listId: input.listId,
      title: input.title,
      done: false,
      due: input.due ?? null,
      createdAt: now,
      updatedAt: now,
    };
    context.setData(saveTodo(todo));
    return todo;
  },
  summarize: ({ input }) => `added "${input.title}"`,
  undo: ({ output }) => ({ name: 'todo.delete', input: { id: output.id } }),
});
