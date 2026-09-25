import type { Todo } from '../../model/todo';
import type { TodoData } from '../../model/todo-data';

/** Inserts or replaces a todo. */
export const saveTodo = (todo: Todo) => (data: TodoData): TodoData => ({ ...data, todos: { ...data.todos, [todo.id]: todo } });

export const removeTodo = (id: string) => (data: TodoData): TodoData => ({
  ...data,
  todos: Object.fromEntries(Object.entries(data.todos).filter(([todoId]) => todoId !== id)),
});
