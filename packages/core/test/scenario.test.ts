import { describe, expect, it } from 'vitest';
import { getPath, parseScenario, runScenario } from '../src';
import { makeApp } from './helpers';

describe('scenario runner', () => {
  it('reads paths with dots and indexes', () => {
    expect(getPath({ a: [{ b: 1 }] }, 'a[0].b')).toBe(1);
    expect(getPath([{ x: 2 }], '[0].x')).toBe(2);
    expect(getPath({}, 'a.b.c')).toBeUndefined();
  });

  it('skips comments and reports the line of a bad step', () => {
    expect(parseScenario('// hi\n\n{"run":"nav.back"}')).toEqual([{ line: 3, step: { run: 'nav.back' } }]);
    expect(() => parseScenario('{"run":"a"}\n{nope}')).toThrow(/Line 2/);
  });

  it('stops at the first failing step with a readable message', async () => {
    const { app } = await makeApp();
    const report = await runScenario(
      parseScenario(
        ['{"expect":"list.list","length":99}', '{"run":"todo.create","input":{"title":"never runs"}}'].join('\n'),
      ),
      app.dispatch,
    );
    expect(report.ok).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]?.message).toBe('list.list: expected length 99, got 2');
  });
});
