import type { AnyActionDefinition } from '../../actions/define-action';
import type { ActionRegistry } from '../../actions/action-registry';
import { ActionError } from '../../foundation/action-error';
import type { Origin } from '../../foundation/origin';
import type { Ports } from '../../foundation/ports';
import type { StateStore } from '../../runtime/state-store';
import type { SystemContext } from '../../runtime/system-context';

export function createHandlerContext(args: {
  store: StateStore;
  ports: Ports;
  registry: ActionRegistry;
  origin: Origin;
  entryId: string;
}): SystemContext {
  const { store, ports, registry, origin, entryId } = args;
  const context: SystemContext = {
    origin,
    entryId,
    data: () => store.get().data,
    setData: (update) => store.update((state) => ({ ...state, data: update(state.data) })),
    state: store.get,
    setState: store.update,
    now: () => ports.clock.now().toISOString(),
    newId: (prefix) => ports.ids.next(prefix),
    replay: (invocation) => {
      const action = registry.find(invocation.name);
      if (!action) throw new ActionError('unknown_action', `Unknown action "${invocation.name}"`);
      return runHandler(action, invocation.input, context).output;
    },
  };
  return context;
}

/** Parses input, runs the handler and validates its output. Throws on failure. */
export function runHandler(action: AnyActionDefinition, rawInput: unknown, context: SystemContext) {
  const input = action.input.parse(rawInput ?? {});
  const output = action.output.parse(action.handler({ input, context }));
  return { input, output };
}
