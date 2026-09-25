import { describe, expect, it } from 'vitest';
import { actionsUsedBy, parseScenario, readPath, runScenario } from '../src';
import { makeRuntime } from './support/make-runtime';

const scenario = (...lines: object[]) => parseScenario(lines.map((line) => JSON.stringify(line)).join('\n'));

describe('scenarios', () => {
  it('parses JSONL, skips comments and reports bad lines', () => {
    expect(parseScenario('// hi\n\n{"run":"nav.back"}')).toEqual([{ line: 3, step: { run: 'nav.back' } }]);
    expect(() => parseScenario('{"run":"a"}\n{nope}')).toThrow(/Line 2/);
    expect(actionsUsedBy(parseScenario('{"run":"a"}\n{"expect":"b"}'))).toEqual(['a', 'b']);
  });

  it('reads paths with dots and indexes', () => {
    expect(readPath({ a: [{ b: 1 }] }, 'a[0].b')).toBe(1);
    expect(readPath([{ x: 2 }], '[0].x')).toBe(2);
    expect(readPath({}, 'a.b')).toBeUndefined();
  });

  it('saves outputs and resolves $references', async () => {
    const { runtime } = await makeRuntime({ fixture: 'empty' });
    const report = await runScenario(
      scenario(
        { run: 'note.add', input: { text: 'Gamma' }, save: 'gamma' },
        { expect: 'note.get', input: { id: '$gamma.id' }, path: 'text', equals: 'Gamma' },
        { run: 'note.remove', input: { id: '$last.id' }, as: 'agent:claude', expectError: 'confirmation_required' },
        { expect: 'app.inspect', path: 'viewModel.notes', contains: { text: 'Gamma' } },
      ),
      runtime.dispatch,
    );
    expect(report.steps.map((step) => step.message)).toEqual([
      'note.add',
      'note.get → text',
      'note.remove failed with confirmation_required as expected',
      'app.inspect → viewModel.notes',
    ]);
    expect(report.ok).toBe(true);
  });

  it('stops at the first failing step with a readable message', async () => {
    const { runtime } = await makeRuntime();
    const report = await runScenario(
      scenario({ expect: 'app.inspect', path: 'viewModel.notes', length: 5 }, { run: 'note.add', input: { text: 'never' } }),
      runtime.dispatch,
    );
    expect(report.ok).toBe(false);
    expect(report.steps).toEqual([expect.objectContaining({ message: 'app.inspect → viewModel.notes: expected length 5, got 2' })]);
  });

  it('pauses between run steps only, and reports each step as it finishes', async () => {
    const { runtime } = await makeRuntime();
    const finished: number[] = [];
    const started = Date.now();
    await runScenario(
      scenario({ run: 'note.add', input: { text: 'a' } }, { expect: 'note.get', input: { id: 'n_a' } }, { run: 'note.add', input: { text: 'b' } }, { run: 'note.add', input: { text: 'c' } }),
      runtime.dispatch,
      { delayMs: 40, onStep: (step) => finished.push(step.line) },
    );
    expect(finished).toEqual([1, 2, 3, 4]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(75);
  });
});
