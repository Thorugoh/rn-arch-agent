import { z } from 'zod';
import type { AnyAppDefinition } from '../runtime/app-definition';
import type { ScreenInspector } from '../screens/screen-inspector';
import { defineSystemAction } from './define-system-action';

export function createInspectAction(app: AnyAppDefinition, inspector: ScreenInspector) {
  return defineSystemAction({
    name: 'app.inspect',
    description: 'The current screen: its route, the actions its UI offers and its view model (what the user sees).',
    risk: 'read',
    input: z.object({}),
    output: z.object({ route: app.routeSchema, actions: z.array(z.string()), viewModel: z.unknown() }),
    handler: ({ context }) => inspector.inspect(context.state()),
  });
}
