import { currentRoute, type Route, type RouteName } from './nav';
import { originLabel, selectCounts, selectLists, selectTodos } from './selectors';
import type { AppState } from './state';

/**
 * A screen is a pure projection of state. React renders it; agents read it as JSON
 * via `app.inspect`. `actions` lists what can be done from here.
 */
type ParamsOf<R extends RouteName> = Extract<Route, { name: R }> extends { params: infer P } ? P : Record<string, never>;

function defineScreen<R extends RouteName, VM>(def: {
  route: R;
  actions: string[];
  viewModel: (s: AppState, params: ParamsOf<R>) => VM;
}) {
  return def;
}

export const listsScreen = defineScreen({
  route: 'lists',
  actions: ['list.create', 'list.delete', 'nav.push'],
  viewModel: (s) => ({
    title: 'Lists',
    lists: selectLists(s).map((l) => ({ id: l.id, name: l.name, open: l.counts.open, done: l.counts.done })),
  }),
});

export const listScreen = defineScreen({
  route: 'list',
  actions: ['todo.create', 'todo.toggle', 'todo.delete', 'ui.setFilter', 'nav.push', 'nav.back'],
  viewModel: (s, { listId }) => {
    const list = s.lists[listId];
    if (!list) return { notFound: true as const, listId };
    return {
      listId,
      title: list.name,
      filter: s.ui.filter,
      counts: selectCounts(s, listId),
      items: selectTodos(s, listId, s.ui.filter).map((t) => ({ id: t.id, title: t.title, done: t.done, due: t.due })),
    };
  },
});

export const todoScreen = defineScreen({
  route: 'todo',
  actions: ['todo.update', 'todo.toggle', 'todo.delete', 'nav.back'],
  viewModel: (s, { todoId }) => {
    const todo = s.todos[todoId];
    if (!todo) return { notFound: true as const, todoId };
    return {
      id: todo.id,
      title: todo.title,
      done: todo.done,
      due: todo.due,
      list: { id: todo.listId, name: s.lists[todo.listId]?.name ?? '?' },
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    };
  },
});

export const activityScreen = defineScreen({
  route: 'activity',
  actions: ['journal.undo', 'nav.back'],
  viewModel: (s) => ({
    title: 'Activity',
    entries: s.journal.map((e) => ({
      id: e.id,
      at: e.at,
      origin: e.origin,
      byAgent: e.origin.startsWith('agent:'),
      text: `${originLabel(e.origin)} ${e.summary}`,
      undoable: Boolean(e.inverse) && !e.undoneBy,
      undone: Boolean(e.undoneBy),
    })),
  }),
});

export const screens = {
  lists: listsScreen,
  list: listScreen,
  todo: todoScreen,
  activity: activityScreen,
} as const;

export type ViewModelOf<R extends RouteName> = ReturnType<(typeof screens)[R]['viewModel']>;

export type Inspection = { route: Route; actions: string[]; viewModel: unknown };

// Memoized per state object so React's useSyncExternalStore gets stable snapshots.
const cache = new WeakMap<AppState, Map<string, unknown>>();

export function viewModelFor<R extends Route>(s: AppState, route: R): ViewModelOf<R['name']> {
  const key = JSON.stringify(route);
  let perState = cache.get(s);
  if (!perState) cache.set(s, (perState = new Map()));
  if (!perState.has(key)) {
    const screen = screens[route.name] as { viewModel: (s: AppState, p: unknown) => unknown };
    perState.set(key, screen.viewModel(s, 'params' in route ? route.params : {}));
  }
  return perState.get(key) as ViewModelOf<R['name']>;
}

/** The structured "screenshot" agents use instead of the accessibility tree. */
export function inspect(s: AppState): Inspection {
  const route = currentRoute(s.nav);
  return { route, actions: screens[route.name].actions, viewModel: viewModelFor(s, route) };
}
