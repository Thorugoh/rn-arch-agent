import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startAppBridge } from '@todo/bridge';
import { startRelay, type Relay } from '@todo/bridge/server';
import { createApp, fixedClock, fixtures, memoryStorage, seqIds, type App } from '@todo/core';
import { main } from '../src/main';

const scenarios = join(import.meta.dirname, '../../../scenarios');

describe('todo --remote (CLI → relay → live app)', () => {
  let relay: Relay;
  let app: App;
  let stopBridge: () => void;
  let relayArgs: string[];
  let approve: (ok: boolean) => void;

  beforeEach(async () => {
    relay = await startRelay({ port: 0 });
    relayArgs = ['--relay', `ws://127.0.0.1:${relay.port}`];
    app = await createApp({
      ports: {
        storage: memoryStorage(fixtures.demo()),
        clock: fixedClock(),
        ids: seqIds(),
        confirm: () => new Promise((r) => (approve = r)),
      },
    });
    stopBridge = startAppBridge(app, { url: `ws://127.0.0.1:${relay.port}`, name: 'ios-sim', platform: 'ios', screenshot: async () => 'aGVsbG8=' }).stop;
    while (!relay.devices().length) await new Promise((r) => setTimeout(r, 10));
  });
  afterEach(async () => {
    stopBridge();
    await relay.close();
  });

  async function cli(...argv: string[]) {
    let out = '';
    let err = '';
    const code = await main([...relayArgs, ...argv], { stdout: (s) => (out += s), stderr: (s) => (err += s) });
    return { code, out, err, json: () => JSON.parse(out) };
  }

  it('runs actions in the live app', async () => {
    const res = await cli('--remote', '--as', 'agent:claude', '--json', 'run', 'todo.create', '{"title":"Remote milk"}');
    expect(res.json()).toMatchObject({ ok: true, value: { title: 'Remote milk' } });
    expect(app.getState().journal[0]).toMatchObject({ origin: 'agent:claude', summary: 'added "Remote milk"' });
  });

  it('inspects the live screen and lists devices', async () => {
    await app.dispatch('nav.push', { route: { name: 'list', params: { listId: 'groceries' } } }, { origin: 'user' });
    expect((await cli('--remote', '--device', 'ios', '--json', 'inspect')).json().value).toMatchObject({ viewModel: { title: 'Groceries' } });
    expect((await cli('--json', 'devices')).json()).toMatchObject([{ name: 'ios-sim' }]);
  });

  it('replays the same scenario files against the live app', async () => {
    const files = ['happy-path', 'agent-safety', 'undo', 'lists'].map((f) => join(scenarios, `${f}.jsonl`));
    const res = await cli('--remote', 'run-script', ...files);
    expect(res.err).toBe('');
    expect(res.code).toBe(0);
    expect(res.out).toContain('remote');
  });

  it('waits for the user to approve on the device', async () => {
    const pending = cli('--remote', '--as', 'agent:claude', '--json', 'run', 'todo.delete', '{"id":"t_eggs"}');
    await new Promise((r) => setTimeout(r, 50));
    approve(false);
    expect((await pending).json()).toMatchObject({ ok: false, error: { code: 'confirmation_denied' } });
    expect(app.getState().todos.t_eggs).toBeDefined();
  });

  it('saves a screenshot', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'todo-shot-'));
    const res = await cli('screenshot', join(dir, 'shot.png'));
    expect(res.code).toBe(0);
    expect(await readFile(join(dir, 'shot.png'), 'utf8')).toBe('hello');
    await rm(dir, { recursive: true, force: true });
  });

  it('streams events with watch until stopped', async () => {
    const stop = new AbortController();
    let out = '';
    const watching = main([...relayArgs, 'watch'], { stdout: (s) => (out += s), stderr: () => {}, signal: stop.signal });
    await new Promise((r) => setTimeout(r, 100));
    await app.dispatch('todo.toggle', { id: 't_eggs' }, { origin: 'agent:claude' });
    await new Promise((r) => setTimeout(r, 50));
    stop.abort();
    expect(await watching).toBe(0);
    expect(out).toMatch(/ios-sim {2}Claude +todo\.toggle +✓ Claude completed "Eggs"/);
  });

  it('explains how to start the relay when it is not running', async () => {
    let err = '';
    const code = await main(['--relay', 'ws://127.0.0.1:1', '--remote', 'inspect'], { stdout: () => {}, stderr: (s) => (err += s) });
    expect(code).toBe(1);
    expect(err).toContain('todo serve');
  });
});
