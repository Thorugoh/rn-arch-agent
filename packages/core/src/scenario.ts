import type { DispatchMeta, DispatchResult } from './app';
import type { Origin } from './domain';

/**
 * Scenarios are JSONL flows shared by humans, agents, tests and CI. The same file
 * runs headlessly (Node) and against a live app (remote mode): only `dispatch` changes.
 *
 *   {"run":"todo.create","input":{"title":"Buy milk"},"save":"milk"}
 *   {"run":"todo.toggle","input":{"id":"$milk.id"}}
 *   {"run":"todo.delete","input":{"id":"$last.deleted.id"},"as":"agent:claude","expectError":"confirmation_required"}
 *   {"expect":"app.inspect","path":"viewModel.items[0].done","equals":true}
 *
 * `"$name.path"` strings resolve against saved outputs; `$last` is the previous `run`.
 */
export type RunStep = {
  run: string;
  input?: unknown;
  as?: Origin;
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
export type Step = RunStep | ExpectStep;

export type Dispatch = (name: string, input: unknown, meta: DispatchMeta) => Promise<DispatchResult>;

export type StepReport = { line: number; step: Step; ok: boolean; message: string; value?: unknown };
export type ScenarioReport = { ok: boolean; steps: StepReport[] };

export function parseScenario(text: string): Array<{ line: number; step: Step }> {
  return text.split('\n').flatMap((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) return [];
    try {
      const step = JSON.parse(line) as Step;
      if (!('run' in step) && !('expect' in step)) throw new Error('step needs "run" or "expect"');
      return [{ line: i + 1, step }];
    } catch (e) {
      throw new Error(`Line ${i + 1}: ${e instanceof Error ? e.message : e}`, { cause: e });
    }
  });
}

/** Every action name a scenario touches, for the coverage check. */
export function actionsUsed(steps: Step[]): string[] {
  return steps.map((s) => ('run' in s ? s.run : s.expect));
}

export function getPath(value: unknown, path: string | undefined): unknown {
  if (!path) return value;
  const parts = path.match(/[^.[\]]+/g) ?? [];
  return parts.reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), value);
}

function resolveRefs(value: unknown, vars: Map<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const [name, ...rest] = value.slice(1).split('.');
    if (name && vars.has(name)) return getPath(vars.get(name), rest.join('.'));
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, vars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, vars)]));
  }
  return value;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as never)[k], (b as never)[k]));
}

const show = (v: unknown) => JSON.stringify(v);

export async function runScenario(
  steps: Array<{ line: number; step: Step }>,
  dispatch: Dispatch,
  opts: { origin?: Origin } = {},
): Promise<ScenarioReport> {
  const vars = new Map<string, unknown>();
  const reports: StepReport[] = [];
  const origin = opts.origin ?? 'user';

  for (const { line, step } of steps) {
    const input = resolveRefs(step.input ?? {}, vars);
    const report = (ok: boolean, message: string, value?: unknown) => {
      reports.push({ line, step, ok, message, value });
      return ok;
    };

    if ('run' in step) {
      // Scenarios never block on a human, so they behave the same headless and against a live app.
      const res = await dispatch(step.run, input, { origin: step.as ?? origin, confirmed: step.yes, interactive: false });
      if (step.expectError) {
        const ok = !res.ok && res.error.code === step.expectError;
        if (!report(ok, ok ? `${step.run} failed with ${step.expectError} as expected` : `${step.run}: expected error ${step.expectError}, got ${res.ok ? 'success' : res.error.code}`)) break;
        continue;
      }
      if (!res.ok) {
        report(false, `${step.run} failed: [${res.error.code}] ${res.error.message}`, res.error);
        break;
      }
      vars.set('last', res.value);
      if (step.save) vars.set(step.save, res.value);
      report(true, `${step.run}`, res.value);
      continue;
    }

    const res = await dispatch(step.expect, input, { origin, interactive: false });
    if (!res.ok) {
      report(false, `${step.expect} failed: [${res.error.code}] ${res.error.message}`, res.error);
      break;
    }
    const actual = getPath(res.value, step.path);
    const where = `${step.expect}${step.path ? ` → ${step.path}` : ''}`;
    let ok = true;
    let message = where;
    if ('equals' in step && !deepEqual(actual, resolveRefs(step.equals, vars))) {
      ok = false;
      message = `${where}: expected ${show(step.equals)}, got ${show(actual)}`;
    } else if (step.length !== undefined && (!Array.isArray(actual) || actual.length !== step.length)) {
      ok = false;
      message = `${where}: expected length ${step.length}, got ${Array.isArray(actual) ? actual.length : show(actual)}`;
    } else if ('contains' in step) {
      const needle = resolveRefs(step.contains, vars);
      const found = Array.isArray(actual)
        ? actual.some((item) => deepEqual(item, needle) || (typeof needle === 'object' && needle && isSubset(needle, item)))
        : typeof actual === 'string' && typeof needle === 'string' && actual.includes(needle);
      if (!found) {
        ok = false;
        message = `${where}: expected to contain ${show(needle)}, got ${show(actual)}`;
      }
    }
    if (!report(ok, message, actual)) break;
  }

  return { ok: reports.length === steps.length && reports.every((r) => r.ok), steps: reports };
}

function isSubset(needle: object, item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  return Object.entries(needle).every(([k, v]) => deepEqual((item as Record<string, unknown>)[k], v));
}
