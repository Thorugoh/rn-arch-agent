import { afterEach, describe, expect, it } from 'vitest';
import { createApp, fixedClock, fixtures, memoryStorage, seqIds, type Confirmer } from '@todo/core';
import { connectRelay, startAppBridge, type BridgeEvent, type RelayClient } from '../src';
import { startRelay, type Relay } from '../src/server';

const cleanups: Array<() => unknown> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function setup(opts: { token?: string; confirm?: Confirmer; screenshot?: () => Promise<string>; name?: string } = {}) {
  const relay: Relay = await startRelay({ port: 0, token: opts.token });
  cleanups.push(() => relay.close());
  const url = `ws://127.0.0.1:${relay.port}`;
  const app = await createApp({
    ports: { storage: memoryStorage(fixtures.demo()), clock: fixedClock(), ids: seqIds(), confirm: opts.confirm },
  });
  const bridge = startAppBridge(app, { url, name: opts.name ?? 'ios-sim', platform: 'ios', token: opts.token, screenshot: opts.screenshot, reconnectMs: 50 });
  cleanups.push(() => bridge.stop());
  await until(() => relay.devices().length === 1);
  return { relay, url, app };
}

async function client(url: string, opts: Parameters<typeof connectRelay>[1] = {}): Promise<RelayClient> {
  const c = await connectRelay(url, opts);
  cleanups.push(() => c.close());
  return c;
}

async function until(check: () => boolean, ms = 2000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('remote mode (relay + app host + client)', () => {
  it('dispatches into the live app and reads the screen back', async () => {
    const { url, app } = await setup();
    const c = await client(url);
    const res = await c.dispatch('todo.create', { title: 'From afar' }, { origin: 'agent:claude' });
    expect(res).toMatchObject({ ok: true, value: { title: 'From afar' } });
    expect(Object.values(app.getState().todos).some((t) => t.title === 'From afar')).toBe(true);

    await c.dispatch('nav.push', { route: { name: 'list', params: { listId: 'inbox' } } }, { origin: 'agent:claude' });
    const screen = await c.inspect();
    expect(screen.route).toEqual({ name: 'list', params: { listId: 'inbox' } });
    expect(screen.viewModel).toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ title: 'From afar' })]) });
  });

  it('lists actions with schemas and connected devices', async () => {
    const { url } = await setup();
    const c = await client(url);
    expect((await c.describe()).map((a) => a.name)).toContain('todo.create');
    expect(await c.devices()).toMatchObject([{ name: 'ios-sim', platform: 'ios' }]);
  });

  it('waits for the human on the device to approve destructive agent actions', async () => {
    let approve: (ok: boolean) => void = () => {};
    const confirm: Confirmer = () => new Promise((r) => (approve = r));
    const { url, app } = await setup({ confirm });
    const c = await client(url);
    const pending = c.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'agent:claude' });
    await new Promise((r) => setTimeout(r, 50));
    expect(app.getState().todos.t_eggs).toBeDefined();
    approve(true);
    expect(await pending).toMatchObject({ ok: true });
    expect(app.getState().todos.t_eggs).toBeUndefined();
  });

  it('streams dispatch and navigation events, including UI taps', async () => {
    const { url, app } = await setup();
    const c = await client(url);
    const events: BridgeEvent[] = [];
    await c.subscribe((e) => events.push(e));
    await app.dispatch('todo.toggle', { id: 't_eggs' }, { origin: 'user' });
    await app.dispatch('nav.push', { route: { name: 'activity' } }, { origin: 'user' });
    await until(() => events.length >= 3);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'dispatch', name: 'todo.toggle', origin: 'user', ok: true, summary: 'completed "Eggs"' }),
        expect.objectContaining({ type: 'nav', route: { name: 'activity' }, device: 'ios-sim' }),
      ]),
    );
  });

  it('returns screenshots when the app provides them', async () => {
    const { url } = await setup({ screenshot: async () => 'iVBORw0KGgo=' });
    const c = await client(url);
    expect(await c.screenshot()).toEqual({ base64: 'iVBORw0KGgo=', format: 'png' });
  });

  it('explains when no app is connected', async () => {
    const relay = await startRelay({ port: 0 });
    cleanups.push(() => relay.close());
    const c = await client(`ws://127.0.0.1:${relay.port}`);
    await expect(c.inspect()).rejects.toThrow(/No app is connected/);
  });

  it('picks a device by prefix and rejects ambiguity', async () => {
    const { url, relay } = await setup({ name: 'ios-sim' });
    const other = await createApp({ ports: { storage: memoryStorage(), clock: fixedClock(), ids: seqIds() } });
    const b2 = startAppBridge(other, { url, name: 'android-emu', platform: 'android', reconnectMs: 50 });
    cleanups.push(() => b2.stop());
    await until(() => relay.devices().length === 2);
    await expect((await client(url)).inspect()).rejects.toThrow(/Several apps are connected/);
    const android = await client(url, { target: 'android' });
    expect((await android.inspect()).viewModel).toMatchObject({ lists: [{ id: 'inbox' }] });
  });

  it('requires the pairing token when one is set', async () => {
    const { url } = await setup({ token: 's3cret' });
    const bad = await client(url, { token: 'nope' });
    await expect(bad.inspect()).rejects.toThrow(/pairing token|closed/);
    const good = await client(url, { token: 's3cret' });
    expect((await good.inspect()).route).toEqual({ name: 'lists' });
  });

  it('fails pending calls when the app disconnects', async () => {
    const confirm: Confirmer = () => new Promise(() => {}); // the human never answers
    const { url, relay } = await setup({ confirm });
    const c = await client(url);
    const pending = c.dispatch('todo.delete', { id: 't_eggs' }, { origin: 'agent:claude' });
    await new Promise((r) => setTimeout(r, 30));
    cleanups.at(-2)!(); // stop the app bridge (registered after the relay)
    await expect(pending).rejects.toThrow(/disconnected/);
    await until(() => relay.devices().length === 0);
  });
});

