import { describe, expect, it } from 'vitest';
import { makeApp, unwrap } from './helpers';

describe('journal', () => {
  it('records writes with their origin and a readable summary', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.toggle', { id: 't_eggs' }, { origin: 'agent:claude' });
    expect(res).toMatchObject({ ok: true, entryId: 'j_1' });
    expect(app.getState().journal[0]).toMatchObject({
      id: 'j_1',
      action: 'todo.toggle',
      origin: 'agent:claude',
      summary: 'completed "Eggs"',
      inverse: { name: 'todo.toggle', input: { id: 't_eggs', done: false } },
    });
  });

  it('does not journal reads, navigation, or failures', async () => {
    const { app } = await makeApp();
    await app.dispatch('todo.list', { listId: 'inbox' }, { origin: 'user' });
    await app.dispatch('nav.push', { route: { name: 'activity' } }, { origin: 'user' });
    await app.dispatch('ui.setFilter', { filter: 'done' }, { origin: 'user' });
    await app.dispatch('todo.toggle', { id: 'missing' }, { origin: 'user' });
    expect(app.getState().journal).toHaveLength(0);
  });

  it('undoes create, update and delete', async () => {
    const { app } = await makeApp();
    const created = unwrap(await app.dispatch<{ id: string }>('todo.create', { title: 'Temp' }, { origin: 'user' }));
    unwrap(await app.dispatch('journal.undo', {}, { origin: 'user' }));
    expect(app.getState().todos[created.id]).toBeUndefined();

    unwrap(await app.dispatch('todo.update', { id: 't_eggs', title: 'Duck eggs' }, { origin: 'user' }));
    unwrap(await app.dispatch('journal.undo', {}, { origin: 'user' }));
    expect(app.getState().todos.t_eggs?.title).toBe('Eggs');

    const before = app.getState().todos.t_eggs;
    unwrap(await app.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'user' }));
    unwrap(await app.dispatch('journal.undo', {}, { origin: 'user' }));
    expect(app.getState().todos.t_eggs).toEqual(before);
  });

  it('undoes a specific older entry and refuses to undo it twice', async () => {
    const { app } = await makeApp();
    const first = await app.dispatch('todo.toggle', { id: 't_eggs' }, { origin: 'user' });
    await app.dispatch('todo.toggle', { id: 't_plants' }, { origin: 'user' });
    const entryId = first.ok ? first.entryId : undefined;
    unwrap(await app.dispatch('journal.undo', { entryId }, { origin: 'agent:claude' }));
    expect(app.getState().todos.t_eggs?.done).toBe(false);
    expect(app.getState().todos.t_plants?.done).toBe(true);
    expect(await app.dispatch('journal.undo', { entryId }, { origin: 'user' })).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
  });

  it('reports a conflict when the undo target has changed since', async () => {
    const { app } = await makeApp();
    await app.dispatch('todo.create', { title: 'Temp' }, { origin: 'user' });
    const created = await app.dispatch('journal.list', { limit: 1 }, { origin: 'user' });
    await app.dispatch('todo.delete', { id: 't_1' }, { origin: 'user' });
    const entryId = created.ok ? (created.value as Array<{ id: string }>)[0]!.id : '';
    const res = await app.dispatch('journal.undo', { entryId }, { origin: 'user' });
    expect(res).toMatchObject({ ok: false, error: { code: 'conflict' } });
  });

  it('shows agent activity with undo in the activity view model', async () => {
    const { app } = await makeApp();
    await app.dispatch('todo.create', { title: 'Buy milk' }, { origin: 'agent:claude' });
    await app.dispatch('nav.push', { route: { name: 'activity' } }, { origin: 'user' });
    expect(app.inspect().viewModel).toMatchObject({
      entries: [{ text: 'Claude added "Buy milk"', byAgent: true, undoable: true, undone: false }],
    });
  });
});
