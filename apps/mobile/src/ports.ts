import { randomUUID } from 'expo-crypto';
import KV from 'expo-sqlite/kv-store';
import type { AppState, Clock, IdGen, Storage } from '@todo/core';

const KEY = 'todo-app-state-v1';

/** React Native adapter for the core Storage port: the whole state as one row in SQLite. */
export const sqliteStorage = (): Storage => ({
  async load() {
    const raw = await KV.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : null;
  },
  async save(state: AppState) {
    await KV.setItemAsync(KEY, JSON.stringify(state));
  },
});

export const systemClock = (): Clock => ({ now: () => new Date() });

export const randomIds = (): IdGen => ({ next: (prefix) => `${prefix}${randomUUID().slice(0, 8)}` });
