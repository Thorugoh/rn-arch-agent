import { z } from 'zod';

/**
 * Who triggered a dispatch. Always set by the shell that owns the channel (the UI, the CLI,
 * an MCP host), never taken from an agent's own tool input.
 */
export type Origin = 'user' | 'system' | `agent:${string}`;

export const OriginSchema = z
  .string()
  .regex(/^(user|system|agent:[\w.-]+)$/, 'origin must be "user", "system" or "agent:<id>"')
  .transform((value) => value as Origin);

export function isAgentOrigin(origin: string): boolean {
  return origin.startsWith('agent:');
}

/** "user" → "You", "agent:claude" → "Claude". */
export function describeOrigin(origin: string): string {
  if (origin === 'user') return 'You';
  if (origin === 'system') return 'System';
  const agentId = origin.replace(/^agent:/, '');
  return agentId.charAt(0).toUpperCase() + agentId.slice(1);
}
