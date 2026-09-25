import { INBOX_ID } from './model/list';
import type { Todo } from './model/todo';
import type { TodoData } from './model/todo-data';

const CREATED_AT = '2026-01-01T09:00:00.000Z';

const inbox = { id: INBOX_ID, name: 'Inbox', createdAt: CREATED_AT };

function todo(id: string, listId: string, title: string, done = false): Todo {
  return { id, listId, title, done, due: null, createdAt: CREATED_AT, updatedAt: CREATED_AT };
}

/** An empty app: just the Inbox. */
export function emptyTodoData(): TodoData {
  return { lists: { [INBOX_ID]: inbox }, todos: {}, filter: 'all' };
}

/** Two lists with a few open and done todos, for demos and tests. */
export function demoTodoData(): TodoData {
  return {
    lists: { [INBOX_ID]: inbox, groceries: { id: 'groceries', name: 'Groceries', createdAt: CREATED_AT } },
    todos: {
      t_report: todo('t_report', INBOX_ID, 'Send weekly report'),
      t_dentist: todo('t_dentist', INBOX_ID, 'Book dentist', true),
      t_plants: todo('t_plants', INBOX_ID, 'Water the plants'),
      t_eggs: todo('t_eggs', 'groceries', 'Eggs'),
      t_coffee: todo('t_coffee', 'groceries', 'Coffee', true),
    },
    filter: 'all',
  };
}

export const todoFixtures = { empty: emptyTodoData, demo: demoTodoData };
