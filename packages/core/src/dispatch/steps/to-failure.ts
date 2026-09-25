import { z } from 'zod';
import { ActionError } from '../../foundation/action-error';
import { failure, type FailedDispatch } from '../dispatch-types';

export function toFailure(error: unknown, actionName: string): FailedDispatch {
  if (error instanceof ActionError) return failure(error.code, error.message, error.details);
  if (error instanceof z.ZodError) return failure('internal', `Invalid output from ${actionName}: ${z.prettifyError(error)}`);
  return failure('internal', error instanceof Error ? error.message : String(error));
}
