import type { AnyActionDefinition } from '../actions/define-action';
import { isAgentOrigin, type Origin } from '../foundation/origin';

export type PolicyDecision = { allow: true; needsConfirmation: boolean } | { allow: false; reason: string };

export type Policy = (args: { action: AnyActionDefinition; origin: Origin; input: unknown }) => PolicyDecision;

export type DefaultPolicyOptions = {
  /** Limit agents to action-name patterns, e.g. { "agent:reader": ["todo.list", "app.*"] }. */
  agentScopes?: Record<string, string[]>;
};

/**
 * Humans can do anything. Agents can read, navigate and write freely (writes are journaled and
 * undoable), but destructive actions need a human's confirmation.
 */
export function defaultPolicy({ agentScopes = {} }: DefaultPolicyOptions = {}): Policy {
  return ({ action, origin }) => {
    if (!isAgentOrigin(origin)) return { allow: true, needsConfirmation: false };
    const scopes = agentScopes[origin];
    if (scopes && !scopes.some((pattern) => matchesPattern(pattern, action.name))) {
      return { allow: false, reason: `${origin} is not allowed to call ${action.name}` };
    }
    return { allow: true, needsConfirmation: action.risk === 'destructive' };
  };
}

function matchesPattern(pattern: string, actionName: string): boolean {
  if (pattern === '*' || pattern === actionName) return true;
  return pattern.endsWith('.*') && actionName.startsWith(pattern.slice(0, -1));
}
