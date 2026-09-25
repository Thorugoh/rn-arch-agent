import { z } from 'zod';
import type { TodoData } from './model/todo-data';

export const TodoRouteSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('lists') }),
  z.object({ name: z.literal('list'), params: z.object({ listId: z.string().min(1) }) }),
  z.object({ name: z.literal('todo'), params: z.object({ todoId: z.string().min(1) }) }),
  z.object({ name: z.literal('activity') }),
]);
export type TodoRoute = z.infer<typeof TodoRouteSchema>;

export function routeExists(route: TodoRoute, data: TodoData): boolean {
  if (route.name === 'list') return Boolean(data.lists[route.params.listId]);
  if (route.name === 'todo') return Boolean(data.todos[route.params.todoId]);
  return true;
}
