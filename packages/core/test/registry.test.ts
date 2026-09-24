import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { actionsUsed, allActions, parseScenario, runScenario } from '../src';
import { makeApp } from './helpers';

const scenarioDir = join(import.meta.dirname, '../../../scenarios');
const scenarioFiles = readdirSync(scenarioDir).filter((f) => f.endsWith('.jsonl'));
const load = (f: string) => parseScenario(readFileSync(join(scenarioDir, f), 'utf8'));

describe('action registry', () => {
  it('has unique names', () => {
    const names = allActions.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(allActions.map((a) => [a.name, a] as const))('%s is self-describing', async (_name, action) => {
    const { app } = await makeApp();
    const info = app.describe().find((d) => d.name === action.name)!;
    expect(action.description.length).toBeGreaterThan(10);
    expect(info.inputSchema).toMatchObject({ type: 'object' });
    if (action.risk === 'destructive') expect(action.confirmText).toBeDefined();
    if (action.risk === 'write' || action.risk === 'destructive') expect(action.summarize).toBeDefined();
  });

  it('every action is covered by at least one scenario', () => {
    const used = new Set(scenarioFiles.flatMap((f) => actionsUsed(load(f).map((s) => s.step))));
    const uncovered = allActions.map((a) => a.name).filter((n) => !used.has(n));
    expect(uncovered).toEqual([]);
  });
});

describe('scenarios (headless)', () => {
  it.each(scenarioFiles)('%s', async (file) => {
    const { app } = await makeApp('empty');
    const report = await runScenario(load(file), app.dispatch);
    const failed = report.steps.find((s) => !s.ok);
    expect(failed?.message ?? 'ok', `line ${failed?.line}`).toBe('ok');
    expect(report.ok).toBe(true);
  });
});
