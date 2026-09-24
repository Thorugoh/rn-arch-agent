import { z } from 'zod';
import { Filter, Id, IsoDate, Todo } from '../domain';
import { prune } from '../nav';
import { selectTodos } from '../selectors';
import type { AppState } from '../state';
import { ActionError, defineAction } from './define';

export function requireTodo(s: AppState, id: string): Todo {
  const todo = s.todos[id];
  if (!todo) throw new ActionError('not_found', `Todo "${id}" does not exist`);
  return todo;
}

export function requireList(s: AppState, id: string) {
  const list = s.lists[id];
  if (!list) {
    throw new ActionError('not_found', `List "${id}" does not exist`, { availableLists: Object.keys(s.lists) });
  }
  return list;
}

const putTodo = (s: AppState, todo: Todo): AppState => ({ ...s, todos: { ...s.todos, [todo.id]: todo } });

export const todoList = defineAction({
  name: 'todo.list',
  description: 'List the todos in a list, optionally filtered by status.',
  risk: 'read',
  input: z.object({ listId: Id, filter: Filter.default('all') }),
  output: z.array(Todo),
  handler: ({ input, ctx }) => {
    requireList(ctx.getState(), input.listId);
    return selectTodos(ctx.getState(), input.listId, input.filter);
  },
});

export const todoGet = defineAction({
  name: 'todo.get',
  description: 'Get one todo by id.',
  risk: 'read',
  input: z.object({ id: Id }),
  output: Todo,
  handler: ({ input, ctx }) => requireTodo(ctx.getState(), input.id),
});

export const todoCreate = defineAction({
  name: 'todo.create',
  description: 'Create a todo in a list (defaults to the Inbox). Returns the new todo.',
  risk: 'write',
  input: z.object({
    listId: Id.default('inbox'),
    title: z.string().trim().min(1).max(200),
    due: IsoDate.nullable().optional(),
  }),
  output: Todo,
  handler: ({ input, ctx }) => {
    requireList(ctx.getState(), input.listId);
    const now = ctx.now();
    const todo: Todo = {
      id: ctx.ports.ids.next('t_'),
      listId: input.listId,
      title: input.title,
      done: false,
      due: input.due ?? null,
      createdAt: now,
      updatedAt: now,
    };
    ctx.setState((s) => putTodo(s, todo));
    return todo;
  },
  summarize: (input) => `added "${input.title}"`,
  inverse: ({ output }) => ({ name: 'todo.delete', input: { id: output.id } }),
});

export const todoUpdate = defineAction({
  name: 'todo.update',
  description: 'Rename a todo and/or change its due date (null clears it).',
  risk: 'write',
  input: z
    .object({
      id: Id,
      title: z.string().trim().min(1).max(200).optional(),
      due: IsoDate.nullable().optional(),
    })
    .refine((i) => i.title !== undefined || i.due !== undefined, 'Provide at least one of: title, due'),
  output: Todo,
  handler: ({ input, ctx }) => {
    const prev = requireTodo(ctx.getState(), input.id);
    const next: Todo = {
      ...prev,
      title: input.title ?? prev.title,
      due: input.due === undefined ? prev.due : input.due,
      updatedAt: ctx.now(),
    };
    ctx.setState((s) => putTodo(s, next));
    return next;
  },
  summarize: (input, output, before) =>
    input.title !== undefined && input.title !== before.todos[input.id]?.title
      ? `renamed "${before.todos[input.id]?.title}" to "${output.title}"`
      : `changed the due date of "${output.title}"`,
  inverse: ({ input, before }) => {
    const prev = before.todos[input.id]!;
    return { name: 'todo.update', input: { id: prev.id, title: prev.title, due: prev.due } };
  },
});

export const todoToggle = defineAction({
  name: 'todo.toggle',
  description: 'Mark a todo done or not done. Without `done`, flips the current status.',
  risk: 'write',
  input: z.object({ id: Id, done: z.boolean().optional() }),
  output: Todo,
  handler: ({ input, ctx }) => {
    const prev = requireTodo(ctx.getState(), input.id);
    const next: Todo = { ...prev, done: input.done ?? !prev.done, updatedAt: ctx.now() };
    ctx.setState((s) => putTodo(s, next));
    return next;
  },
  summarize: (_input, output) => `${output.done ? 'completed' : 'reopened'} "${output.title}"`,
  inverse: ({ input, before }) => ({ name: 'todo.toggle', input: { id: input.id, done: before.todos[input.id]!.done } }),
});

export const todoDelete = defineAction({
  name: 'todo.delete',
  description: 'Delete a todo. Agents need the user to confirm. Can be undone from the Activity screen.',
  risk: 'destructive',
  input: z.object({ id: Id }),
  output: z.object({ deleted: Todo }),
  handler: ({ input, ctx }) => {
    const todo = requireTodo(ctx.getState(), input.id);
    ctx.setState((s) => {
      const { [todo.id]: _removed, ...todos } = s.todos;
      const nav = prune(s.nav, (r) => !(r.name === 'todo' && r.params.todoId === todo.id));
      return { ...s, todos, nav };
    });
    return { deleted: todo };
  },
  confirmText: (input, s) => `Delete "${s.todos[input.id]?.title ?? input.id}"?`,
  summarize: (_input, output) => `deleted "${output.deleted.title}"`,
  inverse: ({ output }) => ({ name: 'todo.restore', input: { todo: output.deleted } }),
});

export const todoRestore = defineAction({
  name: 'todo.restore',
  description: 'Restore a previously deleted todo (as returned by todo.delete).',
  risk: 'write',
  input: z.object({ todo: Todo }),
  output: Todo,
  handler: ({ input, ctx }) => {
    const s = ctx.getState();
    if (s.todos[input.todo.id]) throw new ActionError('conflict', `Todo "${input.todo.id}" already exists`);
    requireList(s, input.todo.listId);
    ctx.setState((st) => putTodo(st, input.todo));
    return input.todo;
  },
  summarize: (input) => `restored "${input.todo.title}"`,
  inverse: ({ output }) => ({ name: 'todo.delete', input: { id: output.id } }),
});

export const todoActions = [todoList, todoGet, todoCreate, todoUpdate, todoToggle, todoDelete, todoRestore];
