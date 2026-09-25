import type { ActionContext } from '../actions/action-context';
import type { Invocation } from '../journal/journal-entry';
import type { AnyRoute } from '../navigation/route';
import type { RuntimeState } from './runtime-state';

/** What built-in actions (navigation, journal, state) get on top of the app-facing context. */
export interface SystemContext<TData = unknown, TRoute extends AnyRoute = AnyRoute> extends ActionContext<TData> {
  /** The id this dispatch's journal entry will get. */
  readonly entryId: string;
  state(): RuntimeState<TData, TRoute>;
  setState(update: (state: RuntimeState<TData, TRoute>) => RuntimeState<TData, TRoute>): void;
  /** Runs another action's handler directly, skipping policy and journaling (used by undo). */
  replay(invocation: Invocation): unknown;
}
