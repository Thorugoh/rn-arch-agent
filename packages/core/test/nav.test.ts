import { describe, expect, it } from 'vitest';
import { viewModelFor } from '../src';
import { makeApp, unwrap } from './helpers';

const user = { origin: 'user' } as const;

describe('navigation as state', () => {
  it('starts on the lists screen with counts', async () => {
    const { app } = await makeApp();
    expect(app.inspect()).toMatchObject({
      route: { name: 'lists' },
      viewModel: { lists: [{ id: 'inbox', open: 2, done: 1 }, { id: 'groceries', open: 1, done: 1 }] },
    });
  });

  it('pushes, goes back, and never pops the root', async () => {
    const { app } = await makeApp();
    unwrap(await app.dispatch('nav.push', { route: { name: 'list', params: { listId: 'groceries' } } }, user));
    expect(app.inspect().viewModel).toMatchObject({ title: 'Groceries', items: [{ title: 'Eggs' }, { title: 'Coffee' }] });
    unwrap(await app.dispatch('nav.back', {}, user));
    unwrap(await app.dispatch('nav.back', {}, user));
    expect(app.getState().nav.stack).toEqual([{ name: 'lists' }]);
  });

  it('refuses to open screens for missing entities', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('nav.push', { route: { name: 'todo', params: { todoId: 'nope' } } }, user);
    expect(res).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('pops the detail screen when its todo is deleted', async () => {
    const { app } = await makeApp();
    await app.dispatch('nav.push', { route: { name: 'list', params: { listId: 'inbox' } } }, user);
    await app.dispatch('nav.push', { route: { name: 'todo', params: { todoId: 't_plants' } } }, user);
    await app.dispatch('todo.delete', { id: 't_plants' }, user);
    expect(app.inspect().route).toEqual({ name: 'list', params: { listId: 'inbox' } });
  });

  it('applies the filter to list view models', async () => {
    const { app } = await makeApp();
    await app.dispatch('nav.push', { route: { name: 'list', params: { listId: 'inbox' } } }, user);
    await app.dispatch('ui.setFilter', { filter: 'done' }, user);
    expect(app.inspect().viewModel).toMatchObject({ filter: 'done', items: [{ title: 'Book dentist' }] });
  });

  it('memoizes view models per state object (stable snapshots for React)', async () => {
    const { app } = await makeApp();
    const route = { name: 'list', params: { listId: 'inbox' } } as const;
    const s = app.getState();
    expect(viewModelFor(s, route)).toBe(viewModelFor(s, route));
    await app.dispatch('todo.toggle', { id: 't_plants' }, user);
    expect(viewModelFor(app.getState(), route)).not.toBe(viewModelFor(s, route));
  });
});
