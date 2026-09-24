import { INBOX_ID } from './domain';
import { emptyState, type AppState } from './state';

const T0 = '2026-01-01T09:00:00.000Z';

export const fixtures = {
  empty: (): AppState => ({
    ...emptyState(),
    lists: { [INBOX_ID]: { id: INBOX_ID, name: 'Inbox', createdAt: T0 } },
  }),
  demo: (): AppState => {
    const todo = (id: string, listId: string, title: string, done = false) => ({
      id, listId, title, done, due: null, createdAt: T0, updatedAt: T0,
    });
    return {
      ...emptyState(),
      lists: {
        [INBOX_ID]: { id: INBOX_ID, name: 'Inbox', createdAt: T0 },
        groceries: { id: 'groceries', name: 'Groceries', createdAt: T0 },
      },
      todos: {
        t_report: todo('t_report', INBOX_ID, 'Send weekly report'),
        t_dentist: todo('t_dentist', INBOX_ID, 'Book dentist', true),
        t_plants: todo('t_plants', INBOX_ID, 'Water the plants'),
        t_eggs: todo('t_eggs', 'groceries', 'Eggs'),
        t_coffee: todo('t_coffee', 'groceries', 'Coffee', true),
      },
    };
  },
} satisfies Record<string, () => AppState>;

export type FixtureName = keyof typeof fixtures;
export const fixtureNames = Object.keys(fixtures) as [FixtureName, ...FixtureName[]];
