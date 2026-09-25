import type { Origin } from './origin';

/** Everything platform-specific sits behind these interfaces; adapters implement them per platform. */

export interface Storage {
  load(): Promise<unknown | null>;
  save(state: unknown): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export type ConfirmationRequest = {
  action: string;
  input: unknown;
  origin: Origin;
  /** Human-readable question, e.g. `Delete "Buy milk"?` */
  question: string;
};

/** Asks the human (a bottom sheet, a terminal prompt, an MCP elicitation). Resolves true when approved. */
export type Confirmer = (request: ConfirmationRequest) => Promise<boolean>;

export type Ports = {
  storage: Storage;
  clock: Clock;
  ids: IdGenerator;
  /** Without a confirmer, actions that need approval fail with `confirmation_required`. */
  confirm?: Confirmer;
};
