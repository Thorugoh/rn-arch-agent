import type { z } from 'zod';
import type { Origin } from '../domain';
import type { Ports } from '../ports';
import type { AppState, Invocation } from '../state';

/**
 * read        – no state change, always allowed
 * nav         – UI/navigation state only, not journaled
 * write       – changes data, journaled, undoable when `inverse` is set
 * destructive – loses data; agent callers need a human's confirmation
 */
export type Risk = 'read' | 'nav' | 'write' | 'destructive';

export type ErrorCode =
  | 'unknown_action'
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'confirmation_required'
  | 'confirmation_denied'
  | 'internal';

/** Throw from a handler to return a structured error an agent can act on. */
export class ActionError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface ActionCtx {
  getState(): AppState;
  setState(update: (s: AppState) => AppState): void;
  now(): string;
  ports: Ports;
  origin: Origin;
  /** Id of the journal entry this dispatch will produce. */
  entryId: string;
  /** Runs another action's handler directly, skipping policy and journaling (used by undo). */
  run(invocation: Invocation): unknown;
}

export interface ActionDef<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  input: I;
  output: O;
  risk: Risk;
  /** Handlers are synchronous: validate first, then call setState once. */
  handler(x: { input: z.output<I>; ctx: ActionCtx }): z.input<O>;
  /** Human-readable past tense for the Activity screen, e.g. `added "Buy milk"`. */
  summarize?(input: z.output<I>, output: z.output<O>, before: AppState): string;
  /** What the confirmation prompt shows for destructive actions, e.g. `Delete "Buy milk"?`. */
  confirmText?(input: z.output<I>, state: AppState): string;
  /** The invocation that undoes this one. */
  inverse?(x: { input: z.output<I>; output: z.output<O>; before: AppState }): Invocation | undefined;
}

export function defineAction<I extends z.ZodType, O extends z.ZodType>(def: ActionDef<I, O>): ActionDef<I, O> {
  return def;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAction = ActionDef<any, any>;
