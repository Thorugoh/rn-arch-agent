import { describe, expect, it } from 'vitest';
import { createRuntime, fixedClock, memoryStorage, sequentialIds } from '../src';
import { notesApp } from './support/notes-app';
import { asUser, makeRuntime } from './support/make-runtime';

const ports = () => ({ clock: fixedClock(), ids: sequentialIds() });

describe('persistence', () => {
  it('saves every change and loads it in a new runtime', async () => {
    const { runtime, storage } = await makeRuntime();
    await runtime.dispatch('note.add', { text: 'Persisted' }, asUser);
    await runtime.flush();
    const reloaded = await createRuntime(notesApp, { ports: { storage, ...ports() } });
    expect(Object.values(reloaded.getState().data.notes).map((note) => note.text)).toContain('Persisted');
  });

  it('starts empty storage from the initial data, and saves it', async () => {
    const storage = memoryStorage();
    const runtime = await createRuntime(notesApp, { ports: { storage, ...ports() } });
    await runtime.flush();
    expect(storage.current()).toMatchObject({ data: { notes: {} }, navigation: { stack: [{ name: 'home' }] } });
  });

  it('refuses to start from corrupt storage', async () => {
    const storage = memoryStorage({ data: 'nope' });
    await expect(createRuntime(notesApp, { ports: { storage, ...ports() } })).rejects.toThrow(/Stored state is invalid/);
  });
});

describe('withMigration', () => {
  it('upgrades old stored shapes on load', async () => {
    const { withMigration } = await import('../src');
    const legacy = memoryStorage({ notes: { n_1: { id: 'n_1', text: 'Old' } } });
    const storage = withMigration(legacy, (stored) =>
      'data' in (stored as object) ? stored : { data: stored, navigation: { stack: [{ name: 'home' }] }, journal: [] },
    );
    const runtime = await createRuntime(notesApp, { ports: { storage, ...ports() } });
    expect(runtime.getState().data.notes.n_1?.text).toBe('Old');
  });
});
