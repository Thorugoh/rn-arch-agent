import type { AnyRoute } from './route';

/**
 * The navigation stack is state owned by the runtime, not by a UI router. Screens render it;
 * agents change it with `nav.*` actions. All functions are pure.
 */
export type NavigationStack<TRoute extends AnyRoute = AnyRoute> = { stack: TRoute[] };

export function startAt<TRoute extends AnyRoute>(route: TRoute): NavigationStack<TRoute> {
  return { stack: [route] };
}

export function currentRoute<TRoute extends AnyRoute>(navigation: NavigationStack<TRoute>): TRoute {
  return navigation.stack[navigation.stack.length - 1]!;
}

export function canGoBack(navigation: NavigationStack): boolean {
  return navigation.stack.length > 1;
}

export function pushRoute<TRoute extends AnyRoute>(navigation: NavigationStack<TRoute>, route: TRoute): NavigationStack<TRoute> {
  return { stack: [...navigation.stack, route] };
}

export function popRoute<TRoute extends AnyRoute>(navigation: NavigationStack<TRoute>): NavigationStack<TRoute> {
  return canGoBack(navigation) ? { stack: navigation.stack.slice(0, -1) } : navigation;
}

/** Drops routes that no longer point at anything (e.g. the detail screen of a deleted item). */
export function keepExistingRoutes<TRoute extends AnyRoute>(
  navigation: NavigationStack<TRoute>,
  exists: (route: TRoute) => boolean,
  root: TRoute,
): NavigationStack<TRoute> {
  const stack = navigation.stack.filter(exists);
  if (stack.length === navigation.stack.length) return navigation;
  return { stack: stack.length > 0 ? stack : [root] };
}
