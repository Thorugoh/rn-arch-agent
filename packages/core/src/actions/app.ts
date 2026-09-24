import { z } from 'zod';
import { Filter, Id } from '../domain';
import { fixtureNames, fixtures } from '../fixtures';
import { Route, back, currentRoute, initialNav, push } from '../nav';
import { inspect } from '../screens';
import { AppState } from '../state';
import { ActionError, defineAction } from './define';
import { requireList, requireTodo } from './todo';

const RouteResult = z.object({ route: Route });

function assertRouteTargetExists(s: AppState, route: Route) {
  if (route.name === 'list') requireList(s, route.params.listId);
  if (route.name === 'todo') requireTodo(s, route.params.todoId);
}

export const navPush = defineAction({
  name: 'nav.push',
  description:
    'Open a screen on top of the current one, e.g. {"route":{"name":"list","params":{"listId":"inbox"}}}. Screens: lists, list, todo, activity.',
  risk: 'nav',
  input: z.object({ route: Route }),
  output: RouteResult,
  handler: ({ input, ctx }) => {
    assertRouteTargetExists(ctx.getState(), input.route);
    ctx.setState((s) => ({ ...s, nav: push(s.nav, input.route) }));
    return { route: input.route };
  },
});

export const navBack = defineAction({
  name: 'nav.back',
  description: 'Go back to the previous screen (no-op on the root screen).',
  risk: 'nav',
  input: z.object({}),
  output: RouteResult,
  handler: ({ ctx }) => {
    ctx.setState((s) => ({ ...s, nav: back(s.nav) }));
    return { route: currentRoute(ctx.getState().nav) };
  },
});

export const navReset = defineAction({
  name: 'nav.reset',
  description: 'Clear the navigation stack and open a route (defaults to the Lists screen).',
  risk: 'nav',
  input: z.object({ route: Route.optional() }),
  output: RouteResult,
  handler: ({ input, ctx }) => {
    const stack = initialNav().stack;
    if (input.route && input.route.name !== 'lists') {
      assertRouteTargetExists(ctx.getState(), input.route);
      stack.push(input.route);
    }
    ctx.setState((s) => ({ ...s, nav: { stack } }));
    return { route: stack[stack.length - 1]! };
  },
});

export const uiSetFilter = defineAction({
  name: 'ui.setFilter',
  description: 'Filter todos shown on list screens: all, open or done.',
  risk: 'nav',
  input: z.object({ filter: Filter }),
  output: z.object({ filter: Filter }),
  handler: ({ input, ctx }) => {
    ctx.setState((s) => ({ ...s, ui: { ...s.ui, filter: input.filter } }));
    return { filter: input.filter };
  },
});

export const appInspect = defineAction({
  name: 'app.inspect',
  description: 'Return the current screen: its route, the actions available on it and its view model (what the user sees).',
  risk: 'read',
  input: z.object({}),
  output: z.object({ route: Route, actions: z.array(z.string()), viewModel: z.unknown() }),
  handler: ({ ctx }) => inspect(ctx.getState()),
});

const ActivityItem = z.object({
  id: Id,
  at: z.string(),
  action: z.string(),
  origin: z.string(),
  summary: z.string(),
  undoable: z.boolean(),
  undone: z.boolean(),
});

export const journalList = defineAction({
  name: 'journal.list',
  description: 'Recent changes (newest first), with who made them and whether they can be undone.',
  risk: 'read',
  input: z.object({ limit: z.number().int().min(1).max(200).default(20) }),
  output: z.array(ActivityItem),
  handler: ({ input, ctx }) =>
    ctx
      .getState()
      .journal.slice(0, input.limit)
      .map((e) => ({
        id: e.id,
        at: e.at,
        action: e.action,
        origin: e.origin,
        summary: e.summary,
        undoable: Boolean(e.inverse) && !e.undoneBy,
        undone: Boolean(e.undoneBy),
      })),
});

export const journalUndo = defineAction({
  name: 'journal.undo',
  description: 'Undo a change from the journal. Without entryId, undoes the most recent undoable change.',
  risk: 'write',
  input: z.object({ entryId: Id.optional() }),
  output: z.object({ undone: Id, summary: z.string() }),
  handler: ({ input, ctx }) => {
    const journal = ctx.getState().journal;
    const entry = input.entryId
      ? journal.find((e) => e.id === input.entryId)
      : journal.find((e) => e.inverse && !e.undoneBy);
    if (!entry) throw new ActionError('not_found', input.entryId ? `No journal entry "${input.entryId}"` : 'Nothing to undo');
    if (!entry.inverse) throw new ActionError('conflict', `"${entry.summary}" cannot be undone`);
    if (entry.undoneBy) throw new ActionError('conflict', `"${entry.summary}" was already undone`);
    try {
      ctx.run(entry.inverse);
    } catch (e) {
      if (e instanceof ActionError) {
        throw new ActionError('conflict', `Cannot undo "${entry.summary}": ${e.message}`, { cause: e.code });
      }
      throw e;
    }
    ctx.setState((s) => ({
      ...s,
      journal: s.journal.map((e) => (e.id === entry.id ? { ...e, undoneBy: ctx.entryId } : e)),
    }));
    return { undone: entry.id, summary: entry.summary };
  },
  summarize: (_input, output) => `undid: ${output.summary}`,
});

export const stateGet = defineAction({
  name: 'state.get',
  description: 'Dump the full app state as JSON (debugging and snapshots).',
  risk: 'read',
  input: z.object({}),
  output: AppState,
  handler: ({ ctx }) => ctx.getState(),
});

export const stateLoad = defineAction({
  name: 'state.load',
  description: `Replace ALL data with a fixture (${fixtureNames.join(', ')}). Agents need the user to confirm.`,
  risk: 'destructive',
  input: z.object({ fixture: z.enum(fixtureNames) }),
  output: z.object({ fixture: z.string() }),
  handler: ({ input, ctx }) => {
    ctx.setState(() => fixtures[input.fixture]());
    return { fixture: input.fixture };
  },
  confirmText: (input) => `Replace all data with the "${input.fixture}" fixture?`,
  summarize: (input) => `loaded the "${input.fixture}" fixture`,
});

export const appActions = [navPush, navBack, navReset, uiSetFilter, appInspect, journalList, journalUndo, stateGet, stateLoad];
