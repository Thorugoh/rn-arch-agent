/** Routes are plain data: `{ name: 'list', params: { listId: 'inbox' } }`. Each app defines its own union. */
export type AnyRoute = { name: string; params?: unknown };

export type RouteParams<TRoute extends AnyRoute, TName extends TRoute['name']> =
  Extract<TRoute, { name: TName }> extends { params: infer TParams } ? TParams : undefined;

export function routeParams(route: AnyRoute): unknown {
  return 'params' in route ? route.params : undefined;
}

export function sameRoute(a: AnyRoute, b: AnyRoute): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
