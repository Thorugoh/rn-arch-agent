import { describe, expect, it } from 'vitest';
import { makeRuntime } from './support/make-runtime';

const strict = { origin: 'agent:tester', uiStrict: true } as const;

describe('strict UI mode', () => {
  it('rejects what the current screen does not offer, naming what it does', async () => {
    const { runtime } = await makeRuntime();
    expect(await runtime.dispatch('note.remove', { id: 'n_a' }, { ...strict, confirmed: true })).toMatchObject({
      ok: false,
      error: {
        code: 'not_on_screen',
        message: 'note.remove isn\'t available on the "home" screen. Available here: note.add, nav.push',
        details: { route: { name: 'home' }, actions: ['note.add', 'nav.push'] },
      },
    });
  });

  it('allows it after navigating like a user, and checks the screen guard', async () => {
    const { runtime } = await makeRuntime();
    expect((await runtime.dispatch('nav.push', { route: { name: 'note', params: { noteId: 'n_a' } } }, strict)).ok).toBe(true);
    expect(await runtime.dispatch('note.remove', { id: 'n_b' }, { ...strict, confirmed: true })).toMatchObject({
      ok: false,
      error: { code: 'not_on_screen', message: 'This screen shows another note' },
    });
    expect((await runtime.dispatch('note.remove', { id: 'n_a' }, { ...strict, confirmed: true })).ok).toBe(true);
  });

  it('always allows reads and harness actions', async () => {
    const { runtime } = await makeRuntime();
    expect((await runtime.dispatch('note.get', { id: 'n_b' }, strict)).ok).toBe(true);
    expect((await runtime.dispatch('state.load', { fixture: 'empty' }, { ...strict, confirmed: true })).ok).toBe(true);
    expect((await runtime.dispatch('nav.reset', {}, strict)).ok).toBe(true);
  });
});
