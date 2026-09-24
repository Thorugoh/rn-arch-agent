import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AppState, Clock, IdGen, Storage } from '@todo/core';

/** Persists the whole state as one JSON file, written atomically. Shared by the CLI and the MCP server. */
export function jsonFileStorage(path: string): Storage {
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8'));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async save(state: AppState) {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${randomUUID()}.tmp`;
      await writeFile(tmp, JSON.stringify(state, null, 2));
      await rename(tmp, path);
    },
  };
}

export const systemClock = (): Clock => ({ now: () => new Date() });

export const randomIds = (): IdGen => ({ next: (prefix) => `${prefix}${randomUUID().slice(0, 8)}` });
