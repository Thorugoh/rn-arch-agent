import { currentRoute, type Route, type RouteName } from './nav';
import { originLabel, selectCounts, selectLists, selectTodos } from './selectors';
import type { AppState } from './state';

/**
 * A screen is a pure projection of state. React renders it; agents read it as JSON
 * via `app.inspect`.
 *
 * `actions` is what the screen's UI offers, as guards over the (validated) input and the view
 * model: return null when a user could do this here, or a reason when they couldn't (e.g. the
 * todo isn't visible). `app.inspect` lists the names; strict UI mode enforces the guards.
 */
type ParamsOf<R extends RouteName> = Extract<Route, { name: R }> extends { params: infer P } ? P : Record<string, never>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Input = any;
export type ScreenGuard<VM> = true | ((input: Input, vm: VM) => string | null);

function defineScreen<R extends RouteName, VM>(def: {
  route: R;
  viewModel: (s: AppState, params: ParamsOf<R>) => VM;
  actions: Record<string, ScreenGuard<VM>>;
}) {
  return def;
}

const reason = (ok: boolean, why: string) => (ok ? null : why);

export const listsScreen = defineScreen({
  route: 'lists',
  viewModel: (s) => ({
    title: 'Lists',
    lists: selectLists(s).map((l) => ({ id: l.id, name: l.name, open: l.counts.open, done: l.counts.done })),
  }),
  actions: {
    'list.create': true,
    'nav.push': ({ route }, vm) =>
      route.name === 'activity'
        ? null
        : route.name === 'list'
          ? reason(vm.lists.some((l) => l.id === route.params.listId), `List "${route.params.listId}" isn't shown here`)
          : `The Lists screen can open a list or Activity, not "${route.name}"`,
  },
});

const visibleItem = (vm: { notFound: true } | { items: { id: string }[]; filter: string }, id: string) =>
  'notFound' in vm
    ? 'This list no longer exists'
    : reason(vm.items.some((i) => i.id === id), `Todo "${id}" isn't visible on this screen (filter: ${vm.filter})`);

export const listScreen = defineScreen({
  route: 'list',
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
  actions: {
    'todo.create': (input, vm) =>
      'notFound' in vm ? 'This list no longer exists' : reason(input.listId === vm.listId, `This screen adds to "${vm.listId}", not "${input.listId}"`),
    'todo.toggle': (input, vm) => visibleItem(vm, input.id),
    'todo.delete': (input, vm) => visibleItem(vm, input.id),
    'ui.setFilter': true,
    'nav.push': ({ route }, vm) =>
      route.name === 'todo' ? visibleItem(vm, route.params.todoId) : `A list can only open one of its todos, not "${route.name}"`,
    'nav.back': true,
  },
});

const thisTodo = (input: { id: string }, vm: { notFound: true } | { id: string }) =>
  'notFound' in vm ? 'This todo no longer exists' : reason(input.id === vm.id, `This screen shows "${vm.id}", not "${input.id}"`);

export const todoScreen = defineScreen({
  route: 'todo',
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
  actions: {
    'todo.update': thisTodo,
    'todo.toggle': thisTodo,
    'todo.delete': thisTodo,
    'nav.back': true,
  },
});

export const activityScreen = defineScreen({
  route: 'activity',
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
  actions: {
    // The UI has an Undo button per entry, so strict mode needs to know which one was "tapped".
    'journal.undo': ({ entryId }, vm) =>
      entryId
        ? reason(vm.entries.some((e) => e.id === entryId && e.undoable), `No Undo button for entry "${entryId}" here`)
        : 'Pass the entryId of the Undo button to tap',
    'nav.back': true,
  },
});

export const screens = {
  lists: listsScreen,
  list: listScreen,
  todo: todoScreen,
  activity: activityScreen,
} as const;

export type ViewModelOf<R extends RouteName> = ReturnType<(typeof screens)[R]['viewModel']>;

export type Inspection = { route: Route; actions: string[]; viewModel: unknown };

/**
 * Could a user do this from the current screen? null if yes, else why not.
 * Used by strict UI mode; `input` must already be validated.
 */
export function checkOnScreen(s: AppState, action: string, input: unknown): string | null {
  const route = currentRoute(s.nav);
  const guards = screens[route.name].actions as Record<string, ScreenGuard<unknown>>;
  const guard = guards[action];
  if (!guard) {
    return `${action} isn't available on the "${route.name}" screen. Available here: ${Object.keys(guards).join(', ') || 'nothing'}`;
  }
  return guard === true ? null : guard(input, viewModelFor(s, route));
}

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
  return { route, actions: Object.keys(screens[route.name].actions), viewModel: viewModelFor(s, route) };
}
