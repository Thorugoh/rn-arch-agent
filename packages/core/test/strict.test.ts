import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScenario, runScenario } from '../src';
import { makeApp } from './helpers';

const strict = { origin: 'agent:tester', uiStrict: true } as const;
const openInbox = { route: { name: 'list', params: { listId: 'inbox' } } };

describe('strict UI mode', () => {
  it('rejects actions the current screen does not offer, and says what is available', async () => {
    const { app } = await makeApp();
    const res = await app.dispatch('todo.toggle', { id: 't_plants' }, strict);
    expect(res).toMatchObject({
      ok: false,
      error: {
        code: 'not_on_screen',
        message: expect.stringContaining('isn\'t available on the "lists" screen. Available here: list.create, nav.push'),
        details: { route: { name: 'lists' } },
      },
    });
    expect(app.getState().todos.t_plants?.done).toBe(false);
  });

  it('allows it after navigating to where the user would tap it', async () => {
    const { app } = await makeApp();
    expect((await app.dispatch('nav.push', openInbox, strict)).ok).toBe(true);
    expect((await app.dispatch('todo.toggle', { id: 't_plants' }, strict)).ok).toBe(true);
  });

  it('requires the item to be visible (not filtered out, not in another list)', async () => {
    const { app } = await makeApp();
    await app.dispatch('nav.push', openInbox, strict);
    await app.dispatch('ui.setFilter', { filter: 'done' }, strict);
    expect(await app.dispatch('todo.toggle', { id: 't_plants' }, strict)).toMatchObject({
      ok: false,
      error: { code: 'not_on_screen', message: expect.stringContaining('isn\'t visible on this screen (filter: done)') },
    });
    expect((await app.dispatch('todo.toggle', { id: 't_eggs' }, strict)).ok).toBe(false); // groceries list
    expect((await app.dispatch('todo.create', { listId: 'groceries', title: 'x' }, strict)).ok).toBe(false);
    expect((await app.dispatch('todo.create', { listId: 'inbox', title: 'x' }, strict)).ok).toBe(true);
  });

  it('only follows links the screen has', async () => {
    const { app } = await makeApp();
    expect((await app.dispatch('nav.push', { route: { name: 'todo', params: { todoId: 't_plants' } } }, strict)).ok).toBe(false);
    expect((await app.dispatch('nav.back', {}, strict)).ok).toBe(false); // nothing to go back to from the root
    await app.dispatch('nav.push', openInbox, strict);
    expect((await app.dispatch('nav.push', { route: { name: 'todo', params: { todoId: 't_plants' } } }, strict)).ok).toBe(true);
    expect((await app.dispatch('todo.update', { id: 't_report', title: 'x' }, strict)).ok).toBe(false); // detail shows another todo
    expect((await app.dispatch('todo.update', { id: 't_plants', title: 'Water the cactus' }, strict)).ok).toBe(true);
  });

  it('undo needs the specific Undo button on the Activity screen', async () => {
    const { app } = await makeApp();
    const created = await app.dispatch('todo.create', { title: 'x' }, { origin: 'user' });
    const entryId = created.ok ? created.entryId : '';
    expect((await app.dispatch('journal.undo', { entryId }, strict)).ok).toBe(false);
    await app.dispatch('nav.push', { route: { name: 'activity' } }, strict);
    expect((await app.dispatch('journal.undo', {}, strict)).ok).toBe(false);
    expect((await app.dispatch('journal.undo', { entryId }, strict)).ok).toBe(true);
  });

  it('always allows reads and harness actions (fixtures, nav.reset)', async () => {
    const { app } = await makeApp();
    for (const [name, input] of [
      ['todo.list', { listId: 'groceries' }],
      ['app.inspect', {}],
      ['state.load', { fixture: 'demo' }],
      ['nav.reset', { route: { name: 'activity' } }],
    ] as const) {
      expect((await app.dispatch(name, input, { ...strict, origin: 'user' })).ok, name).toBe(true);
    }
  });

  it('happy-path.jsonl passes in strict mode', async () => {
    const { app } = await makeApp('empty');
    const file = readFileSync(join(import.meta.dirname, '../../../scenarios/happy-path.jsonl'), 'utf8');
    const report = await runScenario(parseScenario(file), app.dispatch, { uiStrict: true });
    expect(report.steps.find((s) => !s.ok)?.message ?? 'ok').toBe('ok');
  });
});
