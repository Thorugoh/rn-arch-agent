import { activityScreen } from './activity-screen';
import { listScreen } from './list-screen';
import { listsScreen } from './lists-screen';
import { todoScreen } from './todo-screen';

export const todoScreens = { lists: listsScreen, list: listScreen, todo: todoScreen, activity: activityScreen };

export type { ActivityViewModel } from './activity-screen';
export type { ListViewModel } from './list-screen';
export type { ListsViewModel } from './lists-screen';
export type { TodoViewModel } from './todo-screen';
