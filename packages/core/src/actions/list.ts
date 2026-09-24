import { z } from 'zod';
import { INBOX_ID, Id, List, Todo } from '../domain';
import { prune } from '../nav';
import { selectLists, selectTodos } from '../selectors';
import { ActionError, defineAction } from './define';
import { requireList } from './todo';

const Counts = z.object({ all: z.number(), open: z.number(), done: z.number() });

export const listList = defineAction({
  name: 'list.list',
  description: 'List all todo lists with their open/done counts.',
  risk: 'read',
  input: z.object({}),
  output: z.array(List.extend({ counts: Counts })),
  handler: ({ ctx }) => selectLists(ctx.getState()),
});

export const listCreate = defineAction({
  name: 'list.create',
  description: 'Create a new todo list.',
  risk: 'write',
  input: z.object({ name: z.string().trim().min(1).max(80) }),
  output: List,
  handler: ({ input, ctx }) => {
    const s = ctx.getState();
    const taken = Object.values(s.lists).some((l) => l.name.toLowerCase() === input.name.toLowerCase());
    if (taken) throw new ActionError('conflict', `A list named "${input.name}" already exists`);
    const list: List = { id: ctx.ports.ids.next('l_'), name: input.name, createdAt: ctx.now() };
    ctx.setState((st) => ({ ...st, lists: { ...st.lists, [list.id]: list } }));
    return list;
  },
  summarize: (input) => `created the list "${input.name}"`,
  inverse: ({ output }) => ({ name: 'list.delete', input: { id: output.id } }),
});

export const listDelete = defineAction({
  name: 'list.delete',
  description: 'Delete a list and all of its todos. The Inbox cannot be deleted. Agents need the user to confirm.',
  risk: 'destructive',
  input: z.object({ id: Id }),
  output: z.object({ deleted: List, todos: z.array(Todo) }),
  handler: ({ input, ctx }) => {
    if (input.id === INBOX_ID) throw new ActionError('forbidden', 'The Inbox cannot be deleted');
    const s = ctx.getState();
    const list = requireList(s, input.id);
    const todos = selectTodos(s, list.id);
    ctx.setState((st) => {
      const { [list.id]: _removed, ...lists } = st.lists;
      const remaining = Object.fromEntries(Object.entries(st.todos).filter(([, t]) => t.listId !== list.id));
      const nav = prune(st.nav, (r) =>
        r.name === 'list' ? r.params.listId !== list.id : r.name === 'todo' ? Boolean(remaining[r.params.todoId]) : true,
      );
      return { ...st, lists, todos: remaining, nav };
    });
    return { deleted: list, todos };
  },
  confirmText: (input, s) => `Delete the list "${s.lists[input.id]?.name ?? input.id}" and all its todos?`,
  summarize: (_input, output) =>
    `deleted the list "${output.deleted.name}" and its ${output.todos.length} todo${output.todos.length === 1 ? '' : 's'}`,
  inverse: ({ output }) => ({ name: 'list.restore', input: { list: output.deleted, todos: output.todos } }),
});

export const listRestore = defineAction({
  name: 'list.restore',
  description: 'Restore a deleted list together with its todos (as returned by list.delete).',
  risk: 'write',
  input: z.object({ list: List, todos: z.array(Todo) }),
  output: List,
  handler: ({ input, ctx }) => {
    if (ctx.getState().lists[input.list.id]) throw new ActionError('conflict', `List "${input.list.id}" already exists`);
    ctx.setState((st) => ({
      ...st,
      lists: { ...st.lists, [input.list.id]: input.list },
      todos: { ...st.todos, ...Object.fromEntries(input.todos.map((t) => [t.id, t])) },
    }));
    return input.list;
  },
  summarize: (input) => `restored the list "${input.list.name}"`,
  inverse: ({ output }) => ({ name: 'list.delete', input: { id: output.id } }),
});

export const listActions = [listList, listCreate, listDelete, listRestore];
