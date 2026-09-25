import type { Dispatch } from '../dispatch/dispatch-types';
import type { Origin } from '../foundation/origin';
import { checkExpectation } from './matchers';
import { readPath, resolveReferences } from './references';
import type { ExpectStep, NumberedStep, RunStep, ScenarioReport, StepReport } from './scenario-step';
import { isRunStep } from './scenario-step';

export type RunScenarioOptions = {
  origin?: Origin;
  /** Strict UI mode for every step: only what a user could do from the current screen. */
  uiStrict?: boolean;
  /** Pause between `run` steps, e.g. to watch a live app change. `expect` steps don't wait. */
  delayMs?: number;
  /** Called as each step finishes, for live progress output. */
  onStep?: (report: StepReport) => void;
};

/** Runs steps in order and stops at the first failure. */
export async function runScenario(steps: NumberedStep[], dispatch: Dispatch, options: RunScenarioOptions = {}): Promise<ScenarioReport> {
  const saved = new Map<string, unknown>();
  const reports: StepReport[] = [];
  let hasRunAStep = false;

  for (const { line, step } of steps) {
    if (isRunStep(step)) {
      if (hasRunAStep && options.delayMs) await sleep(options.delayMs);
      hasRunAStep = true;
    }
    const outcome = isRunStep(step)
      ? await performRun(step, { dispatch, saved, options })
      : await performExpect(step, { dispatch, saved, options });
    const report = { line, step, ...outcome };
    reports.push(report);
    options.onStep?.(report);
    if (!report.ok) break;
  }

  return { ok: reports.length === steps.length && reports.every((report) => report.ok), steps: reports };
}

type StepOutcome = { ok: boolean; message: string; value?: unknown };
type StepEnvironment = { dispatch: Dispatch; saved: Map<string, unknown>; options: RunScenarioOptions };

async function performRun(step: RunStep, { dispatch, saved, options }: StepEnvironment): Promise<StepOutcome> {
  const result = await dispatch(step.run, resolveReferences(step.input ?? {}, saved), {
    origin: step.as ?? options.origin ?? 'user',
    confirmed: step.yes,
    // Scenarios never wait for a human, so they behave the same headless and on a live app.
    interactive: false,
    uiStrict: options.uiStrict,
  });

  if (step.expectError) {
    const failedAsExpected = !result.ok && result.error.code === step.expectError;
    const got = result.ok ? 'success' : result.error.code;
    return failedAsExpected
      ? { ok: true, message: `${step.run} failed with ${step.expectError} as expected` }
      : { ok: false, message: `${step.run}: expected error ${step.expectError}, got ${got}` };
  }
  if (!result.ok) return { ok: false, message: `${step.run} failed: [${result.error.code}] ${result.error.message}`, value: result.error };

  saved.set('last', result.value);
  if (step.save) saved.set(step.save, result.value);
  return { ok: true, message: step.run, value: result.value };
}

async function performExpect(step: ExpectStep, { dispatch, saved, options }: StepEnvironment): Promise<StepOutcome> {
  const result = await dispatch(step.expect, resolveReferences(step.input ?? {}, saved), {
    origin: options.origin ?? 'user',
    interactive: false,
  });
  if (!result.ok) return { ok: false, message: `${step.expect} failed: [${result.error.code}] ${result.error.message}`, value: result.error };

  const actual = readPath(result.value, step.path);
  const where = `${step.expect}${step.path ? ` → ${step.path}` : ''}`;
  const problem = checkExpectation(step, actual, {
    equals: resolveReferences(step.equals, saved),
    contains: resolveReferences(step.contains, saved),
  });
  return problem ? { ok: false, message: `${where}: ${problem}`, value: actual } : { ok: true, message: where, value: actual };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
