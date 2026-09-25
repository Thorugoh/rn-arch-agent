import type { AnyActionDefinition } from './define-action';

export type ActionRegistry = ReturnType<typeof createActionRegistry>;

export function createActionRegistry(actions: AnyActionDefinition[]) {
  const byName = new Map<string, AnyActionDefinition>();
  for (const action of actions) {
    if (byName.has(action.name)) throw new Error(`Two actions are named "${action.name}"`);
    byName.set(action.name, action);
  }

  return {
    find: (name: string) => byName.get(name),
    all: () => [...byName.values()],
    /** Names in the same namespace ("todo.add" → todo.*), to help agents recover from typos. */
    similarTo(name: string): string[] {
      const namespace = `${name.split('.')[0]}.`;
      const similar = [...byName.keys()].filter((candidate) => candidate.startsWith(namespace));
      return similar.length > 0 ? similar : [...byName.keys()];
    },
  };
}
