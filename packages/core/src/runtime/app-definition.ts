import type { z } from 'zod';
import type { ActionDefinition, AnyActionDefinition } from '../actions/define-action';
import type { AnyRoute, RouteParams } from '../navigation/route';
import type { AnyScreenDefinition, ScreenDefinition } from '../screens/define-screen';

/** Everything the runtime needs to know about an app. This is what an app provides. */
export type AppDefinition<TData, TRoute extends AnyRoute> = {
  name: string;
  dataSchema: z.ZodType<TData>;
  routeSchema: z.ZodType<TRoute>;
  initialRoute: TRoute;
  initialData(): TData;
  /** Named datasets for tests, demos and `state.load`. */
  fixtures?: Record<string, () => TData>;
  actions: AnyActionDefinition[];
  /** One screen per route name. */
  screens: { [TName in TRoute['name']]: AnyScreenDefinition };
  /** Whether a route still points at something. Validates `nav.push` and prunes the stack after deletes. */
  routeExists?(route: TRoute, data: TData): boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAppDefinition = AppDefinition<any, any>;

/**
 * Binds an app's data and route types once, so its actions, screens and definition are typed
 * without repeating generics:
 *
 *   export const { defineAction, defineScreen, defineApp } = createAppKit<TodoData, TodoRoute>();
 */
export function createAppKit<TData, TRoute extends AnyRoute>() {
  return {
    defineAction<TInput extends z.ZodType, TOutput extends z.ZodType>(definition: ActionDefinition<TData, TInput, TOutput>) {
      return definition;
    },
    defineScreen<TName extends TRoute['name'], TViewModel>(
      definition: ScreenDefinition<TData, RouteParams<TRoute, TName>, TViewModel> & { route: TName },
    ) {
      return definition;
    },
    defineApp(definition: AppDefinition<TData, TRoute>) {
      return definition;
    },
  };
}
