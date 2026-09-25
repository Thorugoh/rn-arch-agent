import { createList } from './lists/create-list';
import { deleteList } from './lists/delete-list';
import { listLists } from './lists/list-lists';
import { restoreList } from './lists/restore-list';
import { setFilter } from './set-filter';
import { createTodo } from './todos/create-todo';
import { deleteTodo } from './todos/delete-todo';
import { getTodo } from './todos/get-todo';
import { listTodos } from './todos/list-todos';
import { restoreTodo } from './todos/restore-todo';
import { toggleTodo } from './todos/toggle-todo';
import { updateTodo } from './todos/update-todo';

/** The todo app's own actions. Navigation, journal and state actions come from the runtime. */
export const todoActions = [
  listLists,
  createList,
  deleteList,
  restoreList,
  listTodos,
  getTodo,
  createTodo,
  updateTodo,
  toggleTodo,
  deleteTodo,
  restoreTodo,
  setFilter,
];
