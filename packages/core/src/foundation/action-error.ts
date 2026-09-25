export type ErrorCode =
  | 'unknown_action'
  | 'invalid_input'
  | 'not_found'
  | 'conflict'
  | 'forbidden'
  | 'not_on_screen'
  | 'confirmation_required'
  | 'confirmation_denied'
  | 'internal';

/** Throw from an action handler to return a structured error that an agent can act on. */
export class ActionError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
