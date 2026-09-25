import { z } from 'zod';
import { describeAction } from '../../actions/describe-action';
import type { AnyActionDefinition } from '../../actions/define-action';
import { failure, type FailedDispatch } from '../dispatch-types';

/** Parses the input; on failure returns the schema too, so an agent can correct itself. */
export function validateInput(action: AnyActionDefinition, rawInput: unknown): { ok: true; input: unknown } | FailedDispatch {
  const parsed = action.input.safeParse(rawInput ?? {});
  if (parsed.success) return { ok: true, input: parsed.data };
  return failure('invalid_input', z.prettifyError(parsed.error), {
    issues: parsed.error.issues,
    inputSchema: describeAction(action).inputSchema,
  });
}
