import { z } from 'zod';
import { ActionError } from '../foundation/action-error';
import { currentRoute, popRoute, pushRoute, startAt } from '../navigation/navigation-stack';
import type { AnyRoute } from '../navigation/route';
import type { AnyAppDefinition } from '../runtime/app-definition';
import { defineSystemAction } from './define-system-action';

export function createNavigationActions(app: AnyAppDefinition) {
  const routeResult = z.object({ route: app.routeSchema });

  function assertRouteExists(route: AnyRoute, data: unknown) {
    if (app.routeExists && !app.routeExists(route, data)) {
      throw new ActionError('not_found', `Nothing to show for ${JSON.stringify(route)}`);
    }
  }

  const push = defineSystemAction({
    name: 'nav.push',
    description: `Open a screen on top of the current one. Screens: ${Object.keys(app.screens).join(', ')}.`,
    risk: 'nav',
    input: z.object({ route: app.routeSchema }),
    output: routeResult,
    handler: ({ input, context }) => {
      assertRouteExists(input.route, context.data());
      context.setState((state) => ({ ...state, navigation: pushRoute(state.navigation, input.route) }));
      return { route: input.route };
    },
  });

  const back = defineSystemAction({
    name: 'nav.back',
    description: 'Go back to the previous screen (does nothing on the first screen).',
    risk: 'nav',
    input: z.object({}),
    output: routeResult,
    handler: ({ context }) => {
      context.setState((state) => ({ ...state, navigation: popRoute(state.navigation) }));
      return { route: currentRoute(context.state().navigation) };
    },
  });

  const reset = defineSystemAction({
    name: 'nav.reset',
    description: 'Clear the navigation stack and open a route (defaults to the first screen).',
    risk: 'nav',
    harness: true,
    input: z.object({ route: app.routeSchema.optional() }),
    output: routeResult,
    handler: ({ input, context }) => {
      let navigation = startAt(app.initialRoute);
      if (input.route && input.route.name !== app.initialRoute.name) {
        assertRouteExists(input.route, context.data());
        navigation = pushRoute(navigation, input.route);
      }
      context.setState((state) => ({ ...state, navigation }));
      return { route: currentRoute(navigation) };
    },
  });

  return [push, back, reset];
}
