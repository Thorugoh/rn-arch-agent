import type { Origin } from '../foundation/origin';

/** What an action handler can use. Handlers only see and change the app's own data. */
export interface ActionContext<TData> {
  readonly origin: Origin;
  data(): TData;
  setData(update: (data: TData) => TData): void;
  /** Current time as an ISO string, from the Clock port. */
  now(): string;
  newId(prefix: string): string;
}
