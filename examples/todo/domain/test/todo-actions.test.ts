import { describe, expect, it } from 'vitest';
import type { List, Todo } from '../src';
import { asUser, makeTodoRuntime, valueOf } from './make-todo-runtime';

describe('todo actions', () => {
  it('creates todos in the Inbox by default, trimming the title', async () => {
    const runtime = await makeTodoRuntime('empty');
    const todo = valueOf(await runtime.dispatch<Todo>('todo.create', { title: '  Buy milk ' }, asUser));
    expect(todo).toMatchObject({ id: 't_1', listId: 'inbox', title: 'Buy milk', done: false, due: null });
  });

  it('refuses unknown lists and lists the available ones', async () => {
    const runtime = await makeTodoRuntime();
    expect(await runtime.dispatch('todo.create', { title: 'x', listId: 'nope' }, asUser)).toMatchObject({
      ok: false,
      error: { code: 'not_found', details: { availableLists: ['inbox', 'groceries'] } },
    });
  });

  it('renames, sets and clears due dates, and needs something to change', async () => {
    const runtime = await makeTodoRuntime();
    valueOf(await runtime.dispatch('todo.update', { id: 't_eggs', title: 'Free-range eggs', due: '2026-02-01T10:00:00.000Z' }, asUser));
    expect(runtime.getState().data.todos.t_eggs).toMatchObject({ title: 'Free-range eggs', due: '2026-02-01T10:00:00.000Z' });
    valueOf(await runtime.dispatch('todo.update', { id: 't_eggs', due: null }, asUser));
    expect(runtime.getState().data.todos.t_eggs?.due).toBeNull();
    expect(await runtime.dispatch('todo.update', { id: 't_eggs' }, asUser)).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });

  it('toggles, or sets done explicitly', async () => {
    const runtime = await makeTodoRuntime();
    expect(valueOf(await runtime.dispatch<Todo>('todo.toggle', { id: 't_eggs' }, asUser)).done).toBe(true);
    expect(valueOf(await runtime.dispatch<Todo>('todo.toggle', { id: 't_eggs', done: true }, asUser)).done).toBe(true);
    expect(valueOf(await runtime.dispatch<Todo>('todo.toggle', { id: 't_eggs' }, asUser)).done).toBe(false);
  });

  it('deletes and restores a todo, and undo brings it back', async () => {
    const runtime = await makeTodoRuntime();
    const before = runtime.getState().data.todos.t_eggs;
    valueOf(await runtime.dispatch('todo.delete', { id: 't_eggs' }, asUser));
    expect(runtime.getState().data.todos.t_eggs).toBeUndefined();
    valueOf(await runtime.dispatch('journal.undo', {}, asUser));
    expect(runtime.getState().data.todos.t_eggs).toEqual(before);
  });

  it('describes changes in the journal', async () => {
    const runtime = await makeTodoRuntime();
    await runtime.dispatch('todo.toggle', { id: 't_plants' }, { origin: 'agent:claude' });
    await runtime.dispatch('todo.update', { id: 't_plants', title: 'Water the cactus' }, asUser);
    expect(runtime.getState().journal.map((entry) => entry.summary)).toEqual([
      'renamed "Water the plants" to "Water the cactus"',
      'completed "Water the plants"',
    ]);
  });
});

describe('list actions', () => {
  it('creates lists with unique names', async () => {
    const runtime = await makeTodoRuntime();
    valueOf(await runtime.dispatch<List>('list.create', { name: 'Work' }, asUser));
    expect(await runtime.dispatch('list.create', { name: 'work' }, asUser)).toMatchObject({ ok: false, error: { code: 'conflict' } });
  });

  it('deletes a list with its todos, closes its screen, and restores both', async () => {
    const runtime = await makeTodoRuntime();
    await runtime.dispatch('nav.push', { route: { name: 'list', params: { listId: 'groceries' } } }, asUser);
    const deleted = valueOf(await runtime.dispatch<{ todos: Todo[] }>('list.delete', { id: 'groceries' }, asUser));
    expect(deleted.todos).toHaveLength(2);
    expect(runtime.inspect().route).toEqual({ name: 'lists' });
    valueOf(await runtime.dispatch('journal.undo', {}, asUser));
    expect(Object.values(runtime.getState().data.todos).filter((todo) => todo.listId === 'groceries')).toHaveLength(2);
  });

  it('protects the Inbox', async () => {
    const runtime = await makeTodoRuntime();
    expect(await runtime.dispatch('list.delete', { id: 'inbox' }, asUser)).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });
});
