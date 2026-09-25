import { useCallback, useEffect, useState } from 'react';
import type { NavigationContainerRef, NavigationState, ParamListBase, PartialState } from '@react-navigation/native';
import { useRuntime } from '../hooks/use-runtime';
import { createRouteKeys, sameKeys } from './route-keys';

/**
 * Keeps React Navigation in sync with the runtime's navigation stack, which is the source of truth:
 * - runtime → native: when the stack changes (a tap, the CLI, an agent), reset the native stack to
 *   match. Keys are stable, so existing screens stay and new ones animate in.
 * - native → runtime: when the user pops natively (swipe, header back, Android back), dispatch
 *   `nav.back` so the runtime stays the single source of truth.
 *
 *   const ref = useNavigationContainerRef();
 *   const { initialState, onStateChange } = useNavigationSync(ref);
 *   <NavigationContainer ref={ref} initialState={initialState} onStateChange={onStateChange}>
 */
export function useNavigationSync(ref: { current: NavigationContainerRef<ParamListBase> | null }) {
  const runtime = useRuntime();
  const [routeKeys] = useState(() => createRouteKeys(runtime.getState().navigation.stack));
  const [initialState] = useState<PartialState<NavigationState>>(() => {
    const routes = routeKeys.current();
    return { index: routes.length - 1, routes };
  });

  useEffect(
    () =>
      runtime.subscribe((state, previous) => {
        if (state.navigation === previous.navigation) return;
        const routes = routeKeys.update(state.navigation.stack);
        const container = ref.current;
        const native = container?.isReady() ? container.getRootState() : undefined;
        if (!container || !native || sameKeys(native.routes, routes)) return;
        // Reset with a *complete* state that keeps the navigator's key. A partial state gets a new
        // key, and native-stack's swipe-to-dismiss would then target a stale navigator.
        container.reset({ ...native, index: routes.length - 1, routes: routes as NavigationState['routes'], stale: false });
      }),
    [runtime, routeKeys, ref],
  );

  const onStateChange = useCallback(
    (native: NavigationState | undefined) => {
      if (!native) return;
      const expected = routeKeys.current();
      const popped = expected.length - native.routes.length;
      const nativeIsPrefix = native.routes.every((route, index) => route.key === expected[index]?.key);
      if (popped > 0 && nativeIsPrefix) {
        for (let i = 0; i < popped; i++) void runtime.dispatch('nav.back', {}, { origin: 'user' });
      }
    },
    [runtime, routeKeys],
  );

  return { initialState, onStateChange };
}
