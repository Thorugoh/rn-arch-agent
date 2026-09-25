import { describe, expect, it } from 'vitest';
import { asAgent, asUser, makeRuntime, valueOf } from './support/make-runtime';

describe('dispatch pipeline', () => {
  it('runs an action and returns its output', async () => {
    const { runtime } = await makeRuntime({ fixture: 'empty' });
    const note = valueOf(await runtime.dispatch('note.add', { text: '  Hello ' }, asUser));
    expect(note).toEqual({ id: 'n_1', text: 'Hello' });
    expect(runtime.getState().data.notes.n_1).toEqual(note);
  });

  it('suggests similar names for an unknown action', async () => {
    const { runtime } = await makeRuntime();
    expect(await runtime.dispatch('note.create', {}, asUser)).toMatchObject({
      ok: false,
      error: { code: 'unknown_action', details: { similar: expect.arrayContaining(['note.add']) } },
    });
  });

  it('returns the input schema on invalid input, so agents can correct themselves', async () => {
    const { runtime } = await makeRuntime();
    expect(await runtime.dispatch('note.add', { txt: 'typo' }, asAgent)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input', details: { inputSchema: { properties: { text: { type: 'string' } } } } },
    });
  });

  it('rolls back a failing action completely', async () => {
    const { runtime } = await makeRuntime();
    const before = runtime.getState();
    expect(await runtime.dispatch('note.broken', {}, asUser)).toMatchObject({ ok: false, error: { code: 'internal', message: 'boom' } });
    expect(runtime.getState()).toBe(before);
  });

  it('returns the first result for a repeated idempotency key', async () => {
    const { runtime } = await makeRuntime({ fixture: 'empty' });
    const meta = { ...asAgent, idempotencyKey: 'k1' };
    const first = await runtime.dispatch('note.add', { text: 'Once' }, meta);
    expect(await runtime.dispatch('note.add', { text: 'Once' }, meta)).toEqual(first);
    expect(Object.keys(runtime.getState().data.notes)).toHaveLength(1);
  });

  it('emits every dispatch, including failures, with the journal summary', async () => {
    const { runtime } = await makeRuntime();
    const events: unknown[] = [];
    const stop = runtime.onDispatch((event) => events.push({ name: event.name, ok: event.result.ok, summary: event.summary }));
    await runtime.dispatch('note.add', { text: 'Gamma' }, asUser);
    await runtime.dispatch('note.remove', { id: 'n_a' }, asAgent); // needs confirmation
    stop();
    await runtime.dispatch('note.add', { text: 'Unseen' }, asUser);
    expect(events).toEqual([
      { name: 'note.add', ok: true, summary: 'added "Gamma"' },
      { name: 'note.remove', ok: false, summary: undefined },
    ]);
  });

  it('describes every action, including built-ins, with object input schemas', async () => {
    const { runtime } = await makeRuntime();
    const actions = runtime.describeActions();
    expect(actions.map((action) => action.name)).toEqual(
      expect.arrayContaining(['note.add', 'nav.push', 'nav.back', 'nav.reset', 'app.inspect', 'journal.undo', 'state.get', 'state.load']),
    );
    for (const action of actions) expect(action.inputSchema, action.name).toMatchObject({ type: 'object' });
  });
});
