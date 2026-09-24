import { createApp, fixedClock, fixtures, memoryStorage, seqIds, type CreateAppOptions, type FixtureName, type Ports } from '../src';

export async function makeApp(fixture: FixtureName = 'demo', opts: Omit<Partial<CreateAppOptions>, 'ports'> & { ports?: Partial<Ports> } = {}) {
  const storage = memoryStorage(fixtures[fixture]());
  const app = await createApp({
    ...opts,
    ports: { storage, clock: fixedClock(), ids: seqIds(), ...opts.ports },
  });
  return { app, storage };
}

export function unwrap<T>(res: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!res.ok) throw new Error(`[${res.error.code}] ${res.error.message}`);
  return res.value;
}
