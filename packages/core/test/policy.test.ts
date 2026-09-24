import { describe, expect, it, vi } from 'vitest';
import { defaultPolicy } from '../src';
import { makeApp } from './helpers';

describe('agent policy', () => {
  it('lets humans run destructive actions without confirmation', async () => {
    const { app } = await makeApp();
    expect((await app.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'user' })).ok).toBe(true);
  });

  it('lets agents write freely', async () => {
    const { app } = await makeApp();
    expect((await app.dispatch('todo.create', { title: 'x' }, { origin: 'agent:claude' })).ok).toBe(true);
  });

  it('requires confirmation for destructive agent actions when no confirmer exists', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'agent:claude' });
    expect(res).toMatchObject({ ok: false, error: { code: 'confirmation_required' } });
    expect(app.getState().todos.t_eggs).toBeDefined();
  });

  it('asks the confirm port with a human-readable prompt, and respects approval', async () => {
    const confirm = vi.fn(async () => true);
    const { app } = await makeApp('demo', { ports: { confirm } });
    const res = await app.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'agent:claude' });
    expect(res.ok).toBe(true);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ origin: 'agent:claude', summary: 'Delete "Eggs"?' }));
  });

  it('respects denial', async () => {
    const { app } = await makeApp('demo', { ports: { confirm: async () => false } });
    const res = await app.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'agent:claude' });
    expect(res).toMatchObject({ ok: false, error: { code: 'confirmation_denied' } });
    expect(app.getState().todos.t_eggs).toBeDefined();
  });

  it('skips the prompt when the shell says a human already confirmed', async () => {
    const confirm = vi.fn(async () => false);
    const { app } = await makeApp('demo', { ports: { confirm } });
    const res = await app.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'agent:claude', confirmed: true });
    expect(res.ok).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('limits agents to their scopes', async () => {
    const { app } = await makeApp('demo', { policy: defaultPolicy({ 'agent:reader': ['todo.list', 'todo.get', 'app.*'] }) });
    expect((await app.dispatch('todo.list', { listId: 'inbox' }, { origin: 'agent:reader' })).ok).toBe(true);
    expect((await app.dispatch('app.inspect', {}, { origin: 'agent:reader' })).ok).toBe(true);
    expect(await app.dispatch('todo.create', { title: 'x' }, { origin: 'agent:reader' })).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    // agents without scopes are unaffected
    expect((await app.dispatch('todo.create', { title: 'x' }, { origin: 'agent:claude' })).ok).toBe(true);
  });
});
