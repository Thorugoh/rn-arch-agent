import { todoActions } from './actions';
import { todoFixtures, emptyTodoData } from './fixtures';
import { defineApp } from './kit';
import { TodoDataSchema } from './model/todo-data';
import { routeExists, TodoRouteSchema } from './routes';
import { todoScreens } from './screens';

/** Everything the runtime needs to run the todo app, on any platform. */
export const todoApp = defineApp({
  name: 'todo',
  dataSchema: TodoDataSchema,
  routeSchema: TodoRouteSchema,
  initialRoute: { name: 'lists' },
  initialData: emptyTodoData,
  fixtures: todoFixtures,
  actions: todoActions,
  screens: todoScreens,
  routeExists,
});
