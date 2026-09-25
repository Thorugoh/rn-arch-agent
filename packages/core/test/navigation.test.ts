import { describe, expect, it } from 'vitest';
import { asUser, makeRuntime, valueOf } from './support/make-runtime';

const openNote = (noteId: string) => ({ route: { name: 'note', params: { noteId } } });

describe('navigation as state', () => {
  it('starts on the initial route and inspects the screen', async () => {
    const { runtime } = await makeRuntime();
    expect(runtime.inspect()).toEqual({
      route: { name: 'home' },
      actions: ['note.add', 'nav.push'],
      viewModel: { notes: [{ id: 'n_a', text: 'Alpha' }, { id: 'n_b', text: 'Beta' }] },
    });
  });

  it('pushes, goes back and never pops the first screen', async () => {
    const { runtime } = await makeRuntime();
    valueOf(await runtime.dispatch('nav.push', openNote('n_a'), asUser));
    expect(runtime.inspect().viewModel).toEqual({ id: 'n_a', text: 'Alpha' });
    await runtime.dispatch('nav.back', {}, asUser);
    await runtime.dispatch('nav.back', {}, asUser);
    expect(runtime.getState().navigation.stack).toEqual([{ name: 'home' }]);
  });

  it('refuses routes to things that do not exist', async () => {
    const { runtime } = await makeRuntime();
    expect(await runtime.dispatch('nav.push', openNote('nope'), asUser)).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('closes screens whose item was deleted', async () => {
    const { runtime } = await makeRuntime();
    await runtime.dispatch('nav.push', openNote('n_a'), asUser);
    await runtime.dispatch('note.remove', { id: 'n_a' }, asUser);
    expect(runtime.inspect().route).toEqual({ name: 'home' });
  });

  it('resets to a route', async () => {
    const { runtime } = await makeRuntime();
    valueOf(await runtime.dispatch('nav.reset', { route: { name: 'note', params: { noteId: 'n_b' } } }, asUser));
    expect(runtime.getState().navigation.stack).toEqual([{ name: 'home' }, { name: 'note', params: { noteId: 'n_b' } }]);
  });

  it('returns the same view model object until state changes (stable React snapshots)', async () => {
    const { runtime } = await makeRuntime();
    const first = runtime.viewModel({ name: 'home' });
    expect(runtime.viewModel({ name: 'home' })).toBe(first);
    await runtime.dispatch('note.add', { text: 'Gamma' }, asUser);
    expect(runtime.viewModel({ name: 'home' })).not.toBe(first);
  });
});
