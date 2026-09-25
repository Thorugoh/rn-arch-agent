import type { z } from 'zod';
import type { Invocation } from '../journal/journal-entry';
import type { ActionContext } from './action-context';
import type { Risk } from './risk';

/**
 * An action is one thing the app can do: the only way to change state. The UI, the CLI, agents
 * and tests all call the same actions, so there is one capability surface for all of them.
 */
export interface ActionDefinition<
  TData,
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
  TContext = ActionContext<TData>,
> {
  /** Namespaced, e.g. "todo.create". */
  name: string;
  /** Agents read this as the tool description: say what it does and when to use it. */
  description: string;
  risk: Risk;
  /** Must be an object schema at the top level (MCP requires it). */
  input: TInput;
  output: TOutput;
  /** Test/debug setup with no UI equivalent (e.g. loading fixtures); allowed in strict UI mode. */
  harness?: boolean;
  /** Synchronous: validate first (throw ActionError), then call setData once. */
  handler(args: { input: z.output<TInput>; context: TContext }): z.input<TOutput>;
  /** Past tense for the activity feed, e.g. `added "Buy milk"`. Required for write/destructive actions. */
  summarize?(args: { input: z.output<TInput>; output: z.output<TOutput>; before: TData }): string;
  /** The question a human must approve for destructive actions, e.g. `Delete "Buy milk"?` */
  confirmText?(args: { input: z.output<TInput>; data: TData }): string;
  /** The call that reverts this one, enabling undo. */
  undo?(args: { input: z.output<TInput>; output: z.output<TOutput>; before: TData }): Invocation | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyActionDefinition = ActionDefinition<any, any, any, any>;
