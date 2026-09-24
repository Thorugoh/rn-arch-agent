import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { createApp, viewModelFor, type App, type AppState, type Confirmer, type Route } from '@todo/core';
import { randomIds, sqliteStorage, systemClock } from './ports';

const AppContext = createContext<App | null>(null);

export function AppProvider({ confirm, children, fallback }: { confirm: Confirmer; children: ReactNode; fallback: ReactNode }) {
  const [app, setApp] = useState<App | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    createApp({ ports: { storage: sqliteStorage(), clock: systemClock(), ids: randomIds(), confirm } }).then(setApp, setError);
    // `confirm` is a stable module-level function; the app is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) throw error;
  if (!app) return fallback;
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp must be used inside <AppProvider>');
  return app;
}

/** Subscribe to a slice of core state. The selector must return stable references (view models are memoized). */
export function useAppState<T>(selector: (s: AppState) => T): T {
  const app = useApp();
  return useSyncExternalStore(app.subscribe, () => selector(app.getState()));
}

export function useViewModel<R extends Route>(route: R) {
  const key = JSON.stringify(route);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const select = useCallback((s: AppState) => viewModelFor(s, route), [key]);
  return useAppState(select);
}

/** Every tap goes through the same dispatch as the CLI and agents, tagged origin "user". */
export function useDispatch() {
  const app = useApp();
  return useCallback(
    async (name: string, input: unknown = {}) => {
      const res = await app.dispatch(name, input, { origin: 'user' });
      if (!res.ok) Alert.alert('Could not do that', res.error.message);
      return res;
    },
    [app],
  );
}
