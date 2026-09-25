import { createActionRegistry } from '../actions/action-registry';
import { describeAction, type ActionInfo } from '../actions/describe-action';
import { createBuiltInActions } from '../built-in-actions';
import { createDispatcher } from '../dispatch/create-dispatcher';
import type { Dispatch, DispatchEvent } from '../dispatch/dispatch-types';
import { defaultPolicy, type Policy } from '../dispatch/policy';
import type { Ports } from '../foundation/ports';
import { keepExistingRoutes } from '../navigation/navigation-stack';
import type { AnyRoute } from '../navigation/route';
import { createScreenInspector, type Inspection } from '../screens/screen-inspector';
import type { AppDefinition } from './app-definition';
import { freshState } from './initial-state';
import { loadState, persistChanges } from './persistence';
import { runtimeStateSchema, type RuntimeState } from './runtime-state';
import { createStateStore } from './state-store';

export type RuntimeOptions = {
  ports: Ports;
  policy?: Policy;
};

/** A running app: the same object in the phone, the CLI, tests and the MCP server. */
export interface Runtime<TData = unknown, TRoute extends AnyRoute = AnyRoute> {
  readonly name: string;
  dispatch: Dispatch;
  getState(): RuntimeState<TData, TRoute>;
  subscribe(listener: (state: RuntimeState<TData, TRoute>, previous: RuntimeState<TData, TRoute>) => void): () => void;
  /** Every dispatch (taps, CLI, agents) with its result. */
  onDispatch(listener: (event: DispatchEvent) => void): () => void;
  inspect(): Inspection<TRoute>;
  viewModel(route: TRoute): unknown;
  describeActions(): ActionInfo[];
  /** Resolves once every change so far is persisted. */
  flush(): Promise<void>;
}

export async function createRuntime<TData, TRoute extends AnyRoute>(
  app: AppDefinition<TData, TRoute>,
  { ports, policy = defaultPolicy() }: RuntimeOptions,
): Promise<Runtime<TData, TRoute>> {
  const { state, isNew } = await loadState({
    storage: ports.storage,
    schema: runtimeStateSchema(app.dataSchema, app.routeSchema),
    createFresh: () => freshState(app),
  });
  const store = createStateStore(state);
  const persistence = persistChanges(store, ports.storage, { saveNow: isNew });
  const inspector = createScreenInspector(app.screens);
  const registry = createActionRegistry([...app.actions, ...createBuiltInActions(app, inspector)]);
  const { dispatch, onDispatch } = createDispatcher({
    registry,
    store,
    ports,
    policy,
    inspector,
    afterAction: (current) => dropRoutesToMissingItems(app, current),
  });

  return {
    name: app.name,
    dispatch,
    onDispatch,
    getState: () => store.get() as RuntimeState<TData, TRoute>,
    subscribe: (listener) => store.subscribe(listener as never),
    inspect: () => inspector.inspect(store.get()) as Inspection<TRoute>,
    viewModel: (route) => inspector.viewModelFor(store.get(), route),
    describeActions: () => registry.all().map(describeAction),
    flush: persistence.flush,
  };
}

function dropRoutesToMissingItems<TData, TRoute extends AnyRoute>(app: AppDefinition<TData, TRoute>, state: RuntimeState): RuntimeState {
  const { routeExists } = app;
  if (!routeExists) return state;
  const navigation = keepExistingRoutes(
    state.navigation as RuntimeState<TData, TRoute>['navigation'],
    (route) => routeExists(route, state.data as TData),
    app.initialRoute,
  );
  return navigation === state.navigation ? state : { ...state, navigation };
}
