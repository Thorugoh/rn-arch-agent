import {
  createRuntime,
  fixedClock,
  freshState,
  memoryStorage,
  sequentialIds,
  type DispatchResult,
  type Ports,
  type RuntimeOptions,
} from '../../src';
import { notesApp, notesFixtures } from './notes-app';

export async function makeRuntime(options: { fixture?: 'empty' | 'sample'; ports?: Partial<Ports>; policy?: RuntimeOptions['policy'] } = {}) {
  const storage = memoryStorage(freshState(notesApp, notesFixtures[options.fixture ?? 'sample']()));
  const runtime = await createRuntime(notesApp, {
    ports: { storage, clock: fixedClock(), ids: sequentialIds(), ...options.ports },
    policy: options.policy,
  });
  return { runtime, storage };
}

export const asUser = { origin: 'user' } as const;
export const asAgent = { origin: 'agent:claude' } as const;

export function valueOf<T>(result: DispatchResult<T>): T {
  if (!result.ok) throw new Error(`[${result.error.code}] ${result.error.message}`);
  return result.value;
}
