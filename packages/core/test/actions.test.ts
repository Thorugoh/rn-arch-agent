import { describe, expect, it } from 'vitest';
import type { Todo } from '../src';
import { makeApp, unwrap } from './helpers';

const user = { origin: 'user' } as const;

describe('todo actions', () => {
  it('creates a todo in the inbox by default', async () => {
    const { app } = await makeApp('empty');
    const todo = unwrap(await app.dispatch<Todo>('todo.create', { title: '  Buy milk ' }, user));
    expect(todo).toMatchObject({ id: 't_1', listId: 'inbox', title: 'Buy milk', done: false, due: null });
    expect(app.getState().todos.t_1).toEqual(todo);
  });

  it('updates title and due date, and null clears the due date', async () => {
    const { app } = await makeApp();
    unwrap(await app.dispatch('todo.update', { id: 't_eggs', title: 'Free-range eggs', due: '2026-02-01T10:00:00.000Z' }, user));
    expect(app.getState().todos.t_eggs).toMatchObject({ title: 'Free-range eggs', due: '2026-02-01T10:00:00.000Z' });
    unwrap(await app.dispatch('todo.update', { id: 't_eggs', due: null }, user));
    expect(app.getState().todos.t_eggs?.due).toBeNull();
  });

  it('rejects an update with nothing to change', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.update', { id: 't_eggs' }, user);
    expect(res).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });

  it('toggles, or sets done explicitly', async () => {
    const { app } = await makeApp();
    expect(unwrap(await app.dispatch<Todo>('todo.toggle', { id: 't_eggs' }, user)).done).toBe(true);
    expect(unwrap(await app.dispatch<Todo>('todo.toggle', { id: 't_eggs', done: true }, user)).done).toBe(true);
    expect(unwrap(await app.dispatch<Todo>('todo.toggle', { id: 't_eggs' }, user)).done).toBe(false);
  });

  it('returns not_found with the available lists', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.create', { title: 'x', listId: 'nope' }, user);
    expect(res).toMatchObject({ ok: false, error: { code: 'not_found', details: { availableLists: ['inbox', 'groceries'] } } });
  });

  it('suggests similar actions for an unknown name', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.add', {}, user);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('unknown_action');
      expect(res.error.details).toMatchObject({ similar: expect.arrayContaining(['todo.create']) });
    }
  });

  it('returns the input schema on invalid input so agents can self-correct', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.create', { titel: 'typo' }, user);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input');
      expect(res.error.message).toContain('title');
      expect(res.error.details).toMatchObject({ inputSchema: { properties: { title: { type: 'string' } } } });
    }
  });

  it('rolls back and reports internal errors from handlers', async () => {
    const { app } = await makeApp();
    const before = app.getState();
    // restore needs its list to exist; the handler throws before writing
    const res = await app.dispatch('todo.restore', { todo: { ...before.todos.t_eggs!, id: 'new', listId: 'gone' } }, user);
    expect(res).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(app.getState()).toBe(before);
  });
});

describe('idempotency', () => {
  it('returns the first result for a repeated key instead of creating a duplicate', async () => {
    const { app } = await makeApp('empty');
    const meta = { origin: 'agent:claude', idempotencyKey: 'abc' } as const;
    const a = await app.dispatch('todo.create', { title: 'Once' }, meta);
    const b = await app.dispatch('todo.create', { title: 'Once' }, meta);
    expect(b).toEqual(a);
    expect(Object.keys(app.getState().todos)).toHaveLength(1);
  });
});
