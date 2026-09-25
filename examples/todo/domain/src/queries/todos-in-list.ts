import type { Filter } from '../model/filter';
import type { Todo } from '../model/todo';
import type { TodoData } from '../model/todo-data';

// Stable sort: equal timestamps keep insertion order.
const byCreation = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);

const matchesFilter = (todo: Todo, filter: Filter) => filter === 'all' || (filter === 'done' ? todo.done : !todo.done);

export function todosInList(data: TodoData, listId: string, filter: Filter = 'all'): Todo[] {
  return Object.values(data.todos)
    .filter((todo) => todo.listId === listId && matchesFilter(todo, filter))
    .sort(byCreation);
}

export function countTodos(data: TodoData, listId: string) {
  const todos = todosInList(data, listId);
  const done = todos.filter((todo) => todo.done).length;
  return { all: todos.length, open: todos.length - done, done };
}

export function listsWithCounts(data: TodoData) {
  return Object.values(data.lists)
    .sort(byCreation)
    .map((list) => ({ ...list, counts: countTodos(data, list.id) }));
}
