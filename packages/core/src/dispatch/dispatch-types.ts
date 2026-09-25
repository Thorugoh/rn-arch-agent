import type { ErrorCode } from '../foundation/action-error';
import type { Origin } from '../foundation/origin';

/** Set by the shell that owns the channel (UI, CLI, MCP host), never taken from an agent's tool input. */
export type DispatchMeta = {
  origin: Origin;
  /** A human already approved this call (CLI --yes, a confirmation sheet, an MCP elicitation). */
  confirmed?: boolean;
  /**
   * false = nobody can answer a prompt right now (scripts, CI): fail with `confirmation_required`
   * instead of asking through the Confirmer. Defaults to true.
   */
  interactive?: boolean;
  /** Strict UI mode: only allow what a user could do from the current screen. */
  uiStrict?: boolean;
  /** Retries with the same key return the first result instead of running again. */
  idempotencyKey?: string;
};

export type DispatchFailure = { code: ErrorCode; message: string; details?: unknown };

export type FailedDispatch = { ok: false; error: DispatchFailure };

export type DispatchResult<TValue = unknown> = { ok: true; value: TValue; entryId?: string } | FailedDispatch;

export type Dispatch = <TValue = unknown>(
  name: string,
  input: unknown,
  meta: DispatchMeta,
) => Promise<DispatchResult<TValue>>;

/** Emitted after every dispatch (taps, CLI, agents), e.g. for the remote bridge's live feed. */
export type DispatchEvent = {
  name: string;
  input: unknown;
  meta: DispatchMeta;
  result: DispatchResult;
  /** The journal summary, for writes that succeeded. */
  summary?: string;
};

export function failure(code: ErrorCode, message: string, details?: unknown): FailedDispatch {
  return { ok: false, error: details === undefined ? { code, message } : { code, message, details } };
}
