import { z } from 'zod';
import { Id } from './domain';

/** Navigation is plain data owned by core. The mobile router only renders it. */
export const Route = z.discriminatedUnion('name', [
  z.object({ name: z.literal('lists') }),
  z.object({ name: z.literal('list'), params: z.object({ listId: Id }) }),
  z.object({ name: z.literal('todo'), params: z.object({ todoId: Id }) }),
  z.object({ name: z.literal('activity') }),
]);
export type Route = z.infer<typeof Route>;
export type RouteName = Route['name'];

export const NavState = z.object({ stack: z.array(Route).min(1) });
export type NavState = z.infer<typeof NavState>;

export const initialNav = (): NavState => ({ stack: [{ name: 'lists' }] });

export const currentRoute = (nav: NavState): Route => nav.stack[nav.stack.length - 1]!;

export function push(nav: NavState, route: Route): NavState {
  return { stack: [...nav.stack, route] };
}

export function back(nav: NavState): NavState {
  return nav.stack.length > 1 ? { stack: nav.stack.slice(0, -1) } : nav;
}

/** Drops routes that point at entities that no longer exist (e.g. after a delete). */
export function prune(nav: NavState, keep: (route: Route) => boolean): NavState {
  const stack = nav.stack.filter(keep);
  return stack.length === nav.stack.length ? nav : { stack: stack.length ? stack : initialNav().stack };
}
