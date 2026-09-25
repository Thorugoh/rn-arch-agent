import type { AnyActionDefinition } from '../../actions/define-action';
import type { Confirmer } from '../../foundation/ports';
import { failure, type DispatchMeta, type FailedDispatch } from '../dispatch-types';
import type { Policy } from '../policy';

/** Applies the policy, then asks a human when the action needs confirmation. */
export async function checkPermission(args: {
  action: AnyActionDefinition;
  input: unknown;
  meta: DispatchMeta;
  data: unknown;
  policy: Policy;
  confirm?: Confirmer;
}): Promise<FailedDispatch | undefined> {
  const { action, input, meta, data, policy, confirm } = args;
  const decision = policy({ action, origin: meta.origin, input });
  if (!decision.allow) return failure('forbidden', decision.reason);
  if (!decision.needsConfirmation || meta.confirmed) return undefined;

  const question = action.confirmText?.({ input, data }) ?? `${action.name} ${JSON.stringify(input)}`;
  if (!confirm || meta.interactive === false) {
    return failure(
      'confirmation_required',
      `${action.name} needs the user's approval ("${question}"). Ask the user, then retry with their confirmation.`,
      { action: action.name, input },
    );
  }
  const approved = await confirm({ action: action.name, input, origin: meta.origin, question });
  return approved ? undefined : failure('confirmation_denied', `The user declined: ${question}`);
}
