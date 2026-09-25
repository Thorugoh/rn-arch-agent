import { z } from 'zod';
import type { AnyActionDefinition } from './define-action';
import type { Risk } from './risk';

/** Self-description for agents: becomes MCP tools, CLI help and docs. */
export type ActionInfo = {
  name: string;
  description: string;
  risk: Risk;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export function describeAction(action: AnyActionDefinition): ActionInfo {
  const options = { unrepresentable: 'any' } as const;
  return {
    name: action.name,
    description: action.description,
    risk: action.risk,
    inputSchema: z.toJSONSchema(action.input, { ...options, io: 'input' }) as Record<string, unknown>,
    outputSchema: z.toJSONSchema(action.output, options) as Record<string, unknown>,
  };
}
