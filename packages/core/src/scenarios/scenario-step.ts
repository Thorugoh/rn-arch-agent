import type { Origin } from '../foundation/origin';

/**
 * Scenarios are JSONL flows shared by humans, agents, tests and CI. The same file runs headless
 * and against a live app (remote mode); only the dispatch function changes.
 *
 *   {"run":"todo.create","input":{"title":"Buy milk"},"save":"milk"}
 *   {"run":"todo.toggle","input":{"id":"$milk.id"}}
 *   {"run":"todo.delete","input":{"id":"$milk.id"},"as":"agent:claude","expectError":"confirmation_required"}
 *   {"expect":"app.inspect","path":"viewModel.items[0].done","equals":true}
 *
 * "$name.path" strings refer to saved outputs; "$last" is the previous `run` output.
 */
export type RunStep = {
  run: string;
  input?: unknown;
  as?: Origin;
  /** A human approved this step up front. */
  yes?: boolean;
  save?: string;
  expectError?: string;
};

export type ExpectStep = {
  expect: string;
  input?: unknown;
  path?: string;
  equals?: unknown;
  length?: number;
  contains?: unknown;
};

export type ScenarioStep = RunStep | ExpectStep;

export type NumberedStep = { line: number; step: ScenarioStep };

export type StepReport = { line: number; step: ScenarioStep; ok: boolean; message: string; value?: unknown };

export type ScenarioReport = { ok: boolean; steps: StepReport[] };

export function isRunStep(step: ScenarioStep): step is RunStep {
  return 'run' in step;
}
