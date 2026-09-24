import type { Origin } from './domain';
import type { AppState } from './state';

/** Everything platform-specific sits behind these interfaces. */
export interface Storage {
  load(): Promise<unknown | null>;
  save(state: AppState): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGen {
  next(prefix: string): string;
}

export type ConfirmRequest = {
  action: string;
  input: unknown;
  origin: Origin;
  summary: string;
};

/** Asks the human (bottom sheet, TTY prompt, MCP elicitation). Resolves true when approved. */
export type Confirmer = (req: ConfirmRequest) => Promise<boolean>;

export type Ports = {
  storage: Storage;
  clock: Clock;
  ids: IdGen;
  confirm?: Confirmer;
};
