import { createStore } from 'zustand/vanilla';
import type { RuntimeState } from './runtime-state';

/** A tiny observable container for the runtime state. Framework-free; React binds to it in the shell. */
export type StateStore = {
  get(): RuntimeState;
  update(change: (state: RuntimeState) => RuntimeState): void;
  replace(state: RuntimeState): void;
  subscribe(listener: (state: RuntimeState, previous: RuntimeState) => void): () => void;
};

export function createStateStore(initial: RuntimeState): StateStore {
  const store = createStore<RuntimeState>()(() => initial);
  return {
    get: store.getState,
    update: (change) => store.setState(change(store.getState()), true),
    replace: (state) => store.setState(state, true),
    subscribe: (listener) => store.subscribe(listener),
  };
}
