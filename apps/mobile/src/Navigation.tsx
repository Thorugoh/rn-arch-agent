import { useEffect, useState } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import type { Route } from '@todo/core';
import { useApp } from './AppProvider';
import { ActivityScreen } from './screens/ActivityScreen';
import { ListScreen } from './screens/ListScreen';
import { ListsScreen } from './screens/ListsScreen';
import { TodoScreen } from './screens/TodoScreen';

/**
 * Core owns navigation (`state.nav`); React Navigation only renders it.
 *  - core → native: whenever the core stack changes, reset the native stack to match
 *    (keys are stable, so existing screens are kept and new ones animate in).
 *  - native → core: when the user pops natively (swipe, header back, Android back),
 *    dispatch `nav.back` so core stays the single source of truth.
 */
export type StackParams = {
  lists: undefined;
  list: { listId: string };
  todo: { todoId: string };
  activity: undefined;
};

const Stack = createNativeStackNavigator<StackParams>();

/**
 * React Navigation needs a unique key per route *instance* (it remembers dismissed keys), while
 * core routes are plain data. Keep keys for the unchanged prefix of the stack; mint new ones for
 * anything pushed or replaced.
 */
type Keyed = { routes: Route[]; keys: string[] };
let keySeq = 0;

function rekey(prev: Keyed, next: Route[]): Keyed {
  const keys: string[] = [];
  let unchanged = true;
  next.forEach((route, i) => {
    unchanged = unchanged && i < prev.routes.length && JSON.stringify(prev.routes[i]) === JSON.stringify(route);
    keys.push(unchanged ? prev.keys[i]! : `${route.name}-${++keySeq}`);
  });
  return { routes: next, keys };
}

function toNativeRoutes({ routes, keys }: Keyed) {
  return routes.map((r, i) => ({ key: keys[i]!, name: r.name, params: 'params' in r ? r.params : undefined }));
}

function createNavKeys(stack: Route[]) {
  let keyed = rekey({ routes: [], keys: [] }, stack);
  return {
    routes: () => toNativeRoutes(keyed),
    update: (next: Route[]) => {
      keyed = rekey(keyed, next);
      return toNativeRoutes(keyed);
    },
  };
}

const sameKeys = (a: { key?: string }[], b: { key?: string }[]) => a.length === b.length && a.every((r, i) => r.key === b[i]?.key);

export function Navigation() {
  const app = useApp();
  const ref = useNavigationContainerRef<StackParams>();
  const scheme = useColorScheme();
  const [navKeys] = useState(() => createNavKeys(app.getState().nav.stack));
  const [initialState] = useState<PartialState<NavigationState>>(() => {
    const routes = navKeys.routes();
    return { index: routes.length - 1, routes };
  });

  useEffect(
    () =>
      app.subscribe((s, prev) => {
        if (s.nav === prev.nav) return;
        const routes = navKeys.update(s.nav.stack);
        const current = ref.isReady() ? ref.getRootState() : undefined;
        if (!current || sameKeys(current.routes, routes)) return;
        // Reset with a *complete* state that keeps the navigator's key. A partial state gets
        // rehydrated with a new key, and native-stack's swipe-to-dismiss then targets a stale key
        // ("screen was removed natively but didn't get removed from JS state").
        ref.reset({ ...current, index: routes.length - 1, routes: routes as NavigationState['routes'], stale: false });
      }),
    [app, ref, navKeys],
  );

  function onNativeStateChange(state: NavigationState | undefined) {
    if (!state) return;
    const core = navKeys.routes();
    const popped = core.length - state.routes.length;
    const isPrefix = state.routes.every((r, i) => r.key === core[i]?.key);
    if (popped > 0 && isPrefix) {
      for (let i = 0; i < popped; i++) void app.dispatch('nav.back', {}, { origin: 'user' });
    }
  }

  return (
    <NavigationContainer
      ref={ref}
      initialState={initialState}
      onStateChange={onNativeStateChange}
      theme={scheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <Stack.Navigator screenOptions={{ fullScreenGestureEnabled: true }}>
        <Stack.Screen name="lists" component={ListsScreen} options={{ title: 'Lists' }} />
        <Stack.Screen name="list" component={ListScreen} />
        <Stack.Screen name="todo" component={TodoScreen} options={{ title: '' }} />
        <Stack.Screen name="activity" component={ActivityScreen} options={{ title: 'Activity' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
