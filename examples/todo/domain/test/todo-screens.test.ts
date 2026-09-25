import { describe, expect, it } from 'vitest';
import { asUser, makeTodoRuntime } from './make-todo-runtime';

const strict = { origin: 'agent:tester', uiStrict: true } as const;
const openInbox = { route: { name: 'list', params: { listId: 'inbox' } } };

describe('todo screens', () => {
  it('shows lists with counts', async () => {
    const runtime = await makeTodoRuntime();
    expect(runtime.inspect()).toMatchObject({
      route: { name: 'lists' },
      actions: ['list.create', 'nav.push'],
      viewModel: { lists: [{ id: 'inbox', open: 2, done: 1 }, { id: 'groceries', open: 1, done: 1 }] },
    });
  });

  it('applies the filter to a list screen', async () => {
    const runtime = await makeTodoRuntime();
    await runtime.dispatch('nav.push', openInbox, asUser);
    await runtime.dispatch('ui.setFilter', { filter: 'done' }, asUser);
    expect(runtime.inspect().viewModel).toMatchObject({ filter: 'done', counts: { all: 3 }, items: [{ title: 'Book dentist' }] });
  });

  it('shows the activity feed with who did what', async () => {
    const runtime = await makeTodoRuntime();
    await runtime.dispatch('todo.create', { title: 'Buy milk' }, { origin: 'agent:claude' });
    await runtime.dispatch('nav.push', { route: { name: 'activity' } }, asUser);
    expect(runtime.inspect().viewModel).toMatchObject({ entries: [{ text: 'Claude added "Buy milk"', byAgent: true, undoable: true }] });
  });
});

describe('todo screens in strict UI mode', () => {
  it('only toggles todos visible on the current list under the current filter', async () => {
    const runtime = await makeTodoRuntime();
    expect(await runtime.dispatch('todo.toggle', { id: 't_plants' }, strict)).toMatchObject({ ok: false, error: { code: 'not_on_screen' } });
    await runtime.dispatch('nav.push', openInbox, strict);
    await runtime.dispatch('ui.setFilter', { filter: 'done' }, strict);
    expect(await runtime.dispatch('todo.toggle', { id: 't_plants' }, strict)).toMatchObject({
      ok: false,
      error: { message: 'Todo "t_plants" isn\'t visible on this screen (filter: done)' },
    });
    expect((await runtime.dispatch('todo.toggle', { id: 't_eggs' }, strict)).ok).toBe(false); // another list
    expect((await runtime.dispatch('todo.toggle', { id: 't_dentist' }, strict)).ok).toBe(true);
  });

  it('only adds to the list on screen and only opens visible todos', async () => {
    const runtime = await makeTodoRuntime();
    await runtime.dispatch('nav.push', openInbox, strict);
    expect((await runtime.dispatch('todo.create', { listId: 'groceries', title: 'x' }, strict)).ok).toBe(false);
    expect((await runtime.dispatch('todo.create', { listId: 'inbox', title: 'x' }, strict)).ok).toBe(true);
    expect((await runtime.dispatch('nav.push', { route: { name: 'todo', params: { todoId: 't_eggs' } } }, strict)).ok).toBe(false);
    expect((await runtime.dispatch('nav.push', { route: { name: 'todo', params: { todoId: 't_plants' } } }, strict)).ok).toBe(true);
    expect((await runtime.dispatch('todo.update', { id: 't_report', title: 'x' }, strict)).ok).toBe(false);
    expect((await runtime.dispatch('todo.update', { id: 't_plants', title: 'Water the cactus' }, strict)).ok).toBe(true);
  });

  it('needs the specific Undo button on the Activity screen', async () => {
    const runtime = await makeTodoRuntime();
    const created = await runtime.dispatch('todo.create', { title: 'x' }, asUser);
    const entryId = created.ok ? created.entryId : '';
    expect((await runtime.dispatch('journal.undo', { entryId }, strict)).ok).toBe(false);
    await runtime.dispatch('nav.push', { route: { name: 'activity' } }, strict);
    expect((await runtime.dispatch('journal.undo', {}, strict)).ok).toBe(false);
    expect((await runtime.dispatch('journal.undo', { entryId }, strict)).ok).toBe(true);
  });
});
