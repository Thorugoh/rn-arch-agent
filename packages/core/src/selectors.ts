import type { Filter, Todo } from './domain';
import type { AppState } from './state';

// Stable sort: ties keep insertion order.
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

export function selectTodos(s: AppState, listId: string, filter: Filter = 'all'): Todo[] {
  return Object.values(s.todos)
    .filter((t) => t.listId === listId)
    .filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))
    .sort(byCreated);
}

export function selectCounts(s: AppState, listId: string) {
  const todos = selectTodos(s, listId);
  const done = todos.filter((t) => t.done).length;
  return { all: todos.length, open: todos.length - done, done };
}

export function selectLists(s: AppState) {
  return Object.values(s.lists)
    .sort(byCreated)
    .map((l) => ({ ...l, counts: selectCounts(s, l.id) }));
}

export function originLabel(origin: string): string {
  if (origin === 'user') return 'You';
  if (origin === 'system') return 'System';
  const id = origin.replace(/^agent:/, '');
  return id.charAt(0).toUpperCase() + id.slice(1);
}
