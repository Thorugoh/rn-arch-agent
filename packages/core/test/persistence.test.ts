import { describe, expect, it } from 'vitest';
import { createApp, fixedClock, memoryStorage, seqIds } from '../src';
import { makeApp } from './helpers';

describe('persistence', () => {
  it('saves every change and reloads it in a new app', async () => {
    const { app, storage } = await makeApp();
    await app.dispatch('todo.create', { title: 'Persist me' }, { origin: 'user' });
    await app.flush();
    const again = await createApp({ ports: { storage, clock: fixedClock(), ids: seqIds() } });
    expect(Object.values(again.getState().todos).map((t) => t.title)).toContain('Persist me');
  });

  it('seeds empty storage with the empty fixture and saves it', async () => {
    const storage = memoryStorage();
    const app = await createApp({ ports: { storage, clock: fixedClock(), ids: seqIds() } });
    await app.flush();
    expect(storage.current()?.lists.inbox?.name).toBe('Inbox');
  });

  it('refuses to start from corrupt storage', async () => {
    const storage = { load: async () => ({ lists: 'nope' }), save: async () => {} };
    await expect(createApp({ ports: { storage, clock: fixedClock(), ids: seqIds() } })).rejects.toThrow(/Stored state is invalid/);
  });
});
