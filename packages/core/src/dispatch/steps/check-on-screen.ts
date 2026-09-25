import type { AnyActionDefinition } from '../../actions/define-action';
import type { RuntimeState } from '../../runtime/runtime-state';
import type { ScreenInspector } from '../../screens/screen-inspector';
import { failure, type DispatchMeta, type FailedDispatch } from '../dispatch-types';

/** Strict UI mode: reject what the current screen doesn't offer. Reads and harness actions are exempt. */
export function checkOnScreen(args: {
  action: AnyActionDefinition;
  input: unknown;
  meta: DispatchMeta;
  state: RuntimeState;
  inspector: ScreenInspector;
}): FailedDispatch | undefined {
  const { action, input, meta, state, inspector } = args;
  if (!meta.uiStrict || action.risk === 'read' || action.harness) return undefined;

  const reason = inspector.whyNotOnScreen(state, action.name, input);
  if (!reason) return undefined;
  const screen = inspector.inspect(state);
  return failure('not_on_screen', reason, { route: screen.route, actions: screen.actions });
}
