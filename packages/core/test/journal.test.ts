import { describe, expect, it } from 'vitest';
import { describeJournal } from '../src';
import { asAgent, asUser, makeRuntime, valueOf } from './support/make-runtime';

describe('journal and undo', () => {
  it('records writes with origin, summary and how to undo them', async () => {
    const { runtime } = await makeRuntime();
    const result = await runtime.dispatch('note.add', { text: 'Gamma' }, asAgent);
    expect(result).toMatchObject({ ok: true, entryId: 'j_1' });
    expect(runtime.getState().journal[0]).toMatchObject({
      id: 'j_1',
      action: 'note.add',
      origin: 'agent:claude',
      summary: 'added "Gamma"',
      undo: { name: 'note.remove', input: { id: 'n_1' } },
    });
  });

  it('does not journal reads, navigation or failures', async () => {
    const { runtime } = await makeRuntime();
    await runtime.dispatch('note.get', { id: 'n_a' }, asUser);
    await runtime.dispatch('nav.push', { route: { name: 'note', params: { noteId: 'n_a' } } }, asUser);
    await runtime.dispatch('note.get', { id: 'missing' }, asUser);
    expect(runtime.getState().journal).toEqual([]);
  });

  it('undoes the latest change, then older ones', async () => {
    const { runtime } = await makeRuntime();
    await runtime.dispatch('note.remove', { id: 'n_a' }, asUser);
    await runtime.dispatch('note.add', { text: 'Gamma' }, asUser);
    valueOf(await runtime.dispatch('journal.undo', {}, asUser));
    expect(runtime.getState().data.notes.n_1).toBeUndefined();
    valueOf(await runtime.dispatch('journal.undo', {}, asUser));
    expect(runtime.getState().data.notes.n_a).toEqual({ id: 'n_a', text: 'Alpha' });
    expect(await runtime.dispatch('journal.undo', {}, asUser)).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('refuses to undo twice, and reports conflicts when things changed since', async () => {
    const { runtime } = await makeRuntime();
    const added = await runtime.dispatch('note.add', { text: 'Gamma' }, asUser);
    const entryId = added.ok ? added.entryId : undefined;
    await runtime.dispatch('note.remove', { id: 'n_1' }, asUser);
    expect(await runtime.dispatch('journal.undo', { entryId }, asUser)).toMatchObject({
      ok: false,
      error: { code: 'conflict', message: expect.stringContaining('Cannot undo "added "Gamma""') },
    });
  });

  it('describes the journal for an activity feed', async () => {
    const { runtime } = await makeRuntime();
    await runtime.dispatch('note.add', { text: 'Gamma' }, asAgent);
    await runtime.dispatch('journal.undo', {}, asUser);
    expect(describeJournal(runtime.getState().journal)).toMatchObject([
      { text: 'You undid: added "Gamma"', byAgent: false, undoable: false },
      { text: 'Claude added "Gamma"', byAgent: true, undoable: false, undone: true },
    ]);
  });
});
