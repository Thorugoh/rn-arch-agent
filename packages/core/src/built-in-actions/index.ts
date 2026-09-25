import type { AnyAppDefinition } from '../runtime/app-definition';
import type { ScreenInspector } from '../screens/screen-inspector';
import { createInspectAction } from './inspect-action';
import { journalActions } from './journal-actions';
import { createNavigationActions } from './navigation-actions';
import { createStateActions } from './state-actions';

/** Actions every app gets: navigation, inspection, journal/undo and state/fixtures. */
export function createBuiltInActions(app: AnyAppDefinition, inspector: ScreenInspector) {
  return [...createNavigationActions(app), createInspectAction(app, inspector), ...journalActions, ...createStateActions(app)];
}
