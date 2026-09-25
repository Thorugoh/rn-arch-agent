import type { ActionRegistry } from '../actions/action-registry';
import type { AnyActionDefinition } from '../actions/define-action';
import { isJournaled } from '../actions/risk';
import type { Ports } from '../foundation/ports';
import type { RuntimeState } from '../runtime/runtime-state';
import type { StateStore } from '../runtime/state-store';
import type { ScreenInspector } from '../screens/screen-inspector';
import { failure, type Dispatch, type DispatchEvent, type DispatchMeta, type DispatchResult } from './dispatch-types';
import { createEmitter } from './event-emitter';
import { createIdempotencyCache } from './idempotency-cache';
import type { Policy } from './policy';
import { checkOnScreen } from './steps/check-on-screen';
import { checkPermission } from './steps/check-permission';
import { createHandlerContext, runHandler } from './steps/execute-action';
import { recordInJournal } from './steps/record-in-journal';
import { toFailure } from './steps/to-failure';
import { validateInput } from './steps/validate-input';

export type DispatcherDependencies = {
  registry: ActionRegistry;
  store: StateStore;
  ports: Ports;
  policy: Policy;
  inspector: ScreenInspector;
  /** Runs after every successful action, e.g. to drop routes that point at deleted items. */
  afterAction?: (state: RuntimeState) => RuntimeState;
};

/**
 * The single path every change takes, whoever makes it:
 * find → validate → check screen (strict mode) → check permission → execute → journal → emit.
 */
export function createDispatcher(deps: DispatcherDependencies) {
  const { registry, store, ports, policy, inspector, afterAction } = deps;
  const idempotency = createIdempotencyCache();
  const events = createEmitter<DispatchEvent>();

  const dispatch: Dispatch = async (name, rawInput, meta) => {
    const result = await process(name, rawInput, meta);
    if (events.hasListeners()) events.emit({ name, input: rawInput, meta, result, summary: journalSummary(result) });
    return result as DispatchResult<never>;
  };

  async function process(name: string, rawInput: unknown, meta: DispatchMeta): Promise<DispatchResult> {
    const action = registry.find(name);
    if (!action) return failure('unknown_action', `Unknown action "${name}"`, { similar: registry.similarTo(name) });

    const cached = idempotency.lookup(name, meta);
    if (cached) return cached;

    const validation = validateInput(action, rawInput);
    if (!validation.ok) return validation;

    const state = store.get();
    const notOnScreen = checkOnScreen({ action, input: validation.input, meta, state, inspector });
    if (notOnScreen) return notOnScreen;

    const denied = await checkPermission({ action, input: validation.input, meta, data: state.data, policy, confirm: ports.confirm });
    if (denied) return denied;

    const result = execute(action, rawInput, meta);
    idempotency.remember(name, meta, result);
    return result;
  }

  function execute(action: AnyActionDefinition, rawInput: unknown, meta: DispatchMeta): DispatchResult {
    const before = store.get();
    const entryId = ports.ids.next('j_');
    try {
      const context = createHandlerContext({ store, ports, registry, origin: meta.origin, entryId });
      const { input, output } = runHandler(action, rawInput, context);
      if (afterAction) store.update(afterAction);
      if (!isJournaled(action.risk)) return { ok: true, value: output };

      const at = ports.clock.now().toISOString();
      recordInJournal({ store, action, entryId, at, origin: meta.origin, input, output, dataBefore: before.data });
      return { ok: true, value: output, entryId };
    } catch (error) {
      store.replace(before); // never leave a half-applied change
      return toFailure(error, action.name);
    }
  }

  function journalSummary(result: DispatchResult): string | undefined {
    if (!result.ok || !result.entryId) return undefined;
    return store.get().journal.find((entry) => entry.id === result.entryId)?.summary;
  }

  return { dispatch, onDispatch: events.subscribe };
}
