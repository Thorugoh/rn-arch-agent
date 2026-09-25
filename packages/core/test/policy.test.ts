import { describe, expect, it, vi } from 'vitest';
import { defaultPolicy } from '../src';
import { asAgent, asUser, makeRuntime } from './support/make-runtime';

describe('policy and confirmation', () => {
  it('lets humans run destructive actions without confirmation', async () => {
    const { runtime } = await makeRuntime();
    expect((await runtime.dispatch('note.remove', { id: 'n_a' }, asUser)).ok).toBe(true);
  });

  it('lets agents write freely', async () => {
    const { runtime } = await makeRuntime();
    expect((await runtime.dispatch('note.add', { text: 'x' }, asAgent)).ok).toBe(true);
  });

  it('requires confirmation for destructive agent actions when nobody can be asked', async () => {
    const { runtime } = await makeRuntime();
    expect(await runtime.dispatch('note.remove', { id: 'n_a' }, asAgent)).toMatchObject({
      ok: false,
      error: { code: 'confirmation_required', message: expect.stringContaining('Delete "Alpha"?') },
    });
    expect(runtime.getState().data.notes.n_a).toBeDefined();
  });

  it('asks the confirmer and respects approval or denial', async () => {
    const confirm = vi.fn(async () => true);
    const { runtime } = await makeRuntime({ ports: { confirm } });
    expect((await runtime.dispatch('note.remove', { id: 'n_a' }, asAgent)).ok).toBe(true);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ origin: 'agent:claude', question: 'Delete "Alpha"?' }));

    confirm.mockResolvedValueOnce(false);
    expect(await runtime.dispatch('note.remove', { id: 'n_b' }, asAgent)).toMatchObject({ ok: false, error: { code: 'confirmation_denied' } });
  });

  it('skips the question when a human already approved, and never asks non-interactive callers', async () => {
    const confirm = vi.fn(async () => true);
    const { runtime } = await makeRuntime({ ports: { confirm } });
    expect((await runtime.dispatch('note.remove', { id: 'n_a' }, { ...asAgent, confirmed: true })).ok).toBe(true);
    expect(await runtime.dispatch('note.remove', { id: 'n_b' }, { ...asAgent, interactive: false })).toMatchObject({
      ok: false,
      error: { code: 'confirmation_required' },
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('limits agents to their scopes', async () => {
    const { runtime } = await makeRuntime({ policy: defaultPolicy({ agentScopes: { 'agent:reader': ['note.get', 'app.*'] } }) });
    const reader = { origin: 'agent:reader' } as const;
    expect((await runtime.dispatch('note.get', { id: 'n_a' }, reader)).ok).toBe(true);
    expect((await runtime.dispatch('app.inspect', {}, reader)).ok).toBe(true);
    expect(await runtime.dispatch('note.add', { text: 'x' }, reader)).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect((await runtime.dispatch('note.add', { text: 'x' }, asAgent)).ok).toBe(true);
  });
});
