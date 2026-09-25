import type { JournalEntry } from '../journal/journal-entry';

/**
 * A screen is a pure projection of state (its view model) plus what its UI offers (its actions).
 * React renders the view model; agents read the same view model as JSON through `app.inspect`.
 */
export type ViewModelContext<TData, TParams> = {
  data: TData;
  params: TParams;
  journal: JournalEntry[];
};

/**
 * `true` when the screen always offers the action, or a function that returns null when a user
 * could do it from here and a reason when they couldn't (e.g. the item isn't visible).
 * Strict UI mode enforces these guards.
 */
export type ScreenGuard<TViewModel> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  true | ((args: { input: any; viewModel: TViewModel }) => string | null);

export interface ScreenDefinition<TData, TParams, TViewModel> {
  /** The route name this screen renders. */
  route: string;
  viewModel(context: ViewModelContext<TData, TParams>): TViewModel;
  actions: Record<string, ScreenGuard<TViewModel>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyScreenDefinition = ScreenDefinition<any, any, any>;

/** For guards: `allowIf(isVisible, "Todo isn't visible")`. */
export function allowIf(condition: boolean, reason: string): string | null {
  return condition ? null : reason;
}
