import { currentRoute } from '../navigation/navigation-stack';
import { routeParams, type AnyRoute } from '../navigation/route';
import type { RuntimeState } from '../runtime/runtime-state';
import type { AnyScreenDefinition, ScreenGuard } from './define-screen';

/** The structured "screenshot" agents use instead of the accessibility tree. */
export type Inspection<TRoute extends AnyRoute = AnyRoute> = {
  route: TRoute;
  /** What the UI offers on this screen. */
  actions: string[];
  viewModel: unknown;
};

export type ScreenInspector = ReturnType<typeof createScreenInspector>;

export function createScreenInspector(screens: Record<string, AnyScreenDefinition>) {
  // Memoized per state object, so React gets stable snapshots (useSyncExternalStore).
  const cache = new WeakMap<RuntimeState, Map<string, unknown>>();

  function screenFor(route: AnyRoute): AnyScreenDefinition {
    const screen = screens[route.name];
    if (!screen) throw new Error(`No screen is defined for route "${route.name}"`);
    return screen;
  }

  function viewModelFor(state: RuntimeState, route: AnyRoute): unknown {
    const key = JSON.stringify(route);
    let viewModels = cache.get(state);
    if (!viewModels) cache.set(state, (viewModels = new Map()));
    if (!viewModels.has(key)) {
      const context = { data: state.data, params: routeParams(route), journal: state.journal };
      viewModels.set(key, screenFor(route).viewModel(context));
    }
    return viewModels.get(key);
  }

  function inspect(state: RuntimeState): Inspection {
    const route = currentRoute(state.navigation);
    return { route, actions: Object.keys(screenFor(route).actions), viewModel: viewModelFor(state, route) };
  }

  /** Could a user do this from the current screen? null if yes, otherwise why not. */
  function whyNotOnScreen(state: RuntimeState, actionName: string, input: unknown): string | null {
    const route = currentRoute(state.navigation);
    const guards = screenFor(route).actions as Record<string, ScreenGuard<unknown>>;
    const guard = guards[actionName];
    if (!guard) {
      const available = Object.keys(guards).join(', ') || 'nothing';
      return `${actionName} isn't available on the "${route.name}" screen. Available here: ${available}`;
    }
    return guard === true ? null : guard({ input, viewModel: viewModelFor(state, route) });
  }

  return { viewModelFor, inspect, whyNotOnScreen };
}
