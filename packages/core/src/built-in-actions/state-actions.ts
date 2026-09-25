import { z } from 'zod';
import type { AnyAppDefinition } from '../runtime/app-definition';
import { freshState } from '../runtime/initial-state';
import { runtimeStateSchema } from '../runtime/runtime-state';
import { defineSystemAction } from './define-system-action';

export function createStateActions(app: AnyAppDefinition) {
  const getState = defineSystemAction({
    name: 'state.get',
    description: 'The full app state as JSON (data, navigation, journal). For debugging and snapshots.',
    risk: 'read',
    input: z.object({}),
    output: runtimeStateSchema(app.dataSchema, app.routeSchema),
    handler: ({ context }) => context.state(),
  });

  const fixtureNames = Object.keys(app.fixtures ?? {});
  if (fixtureNames.length === 0) return [getState];

  const loadFixture = defineSystemAction({
    name: 'state.load',
    description: `Replace ALL data with a fixture (${fixtureNames.join(', ')}). Agents need the user to confirm.`,
    risk: 'destructive',
    harness: true,
    input: z.object({ fixture: z.enum(fixtureNames as [string, ...string[]]) }),
    output: z.object({ fixture: z.string() }),
    handler: ({ input, context }) => {
      context.setState(() => freshState(app, app.fixtures![input.fixture]!()));
      return { fixture: input.fixture };
    },
    confirmText: ({ input }) => `Replace all data with the "${input.fixture}" fixture?`,
    summarize: ({ input }) => `loaded the "${input.fixture}" fixture`,
  });

  return [getState, loadFixture];
}
