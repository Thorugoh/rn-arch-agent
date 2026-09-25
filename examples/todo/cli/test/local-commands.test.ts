import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTodoCli, scenarioFile } from './run-todo-cli';

describe('todo CLI, local (headless)', () => {
  let directory: string;
  let dataFile: string[];
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'todo-cli-'));
    dataFile = ['--data', join(directory, 'state.json')];
  });
  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('keeps state between separate invocations', async () => {
    const created = await runTodoCli([...dataFile, '--json', 'run', 'todo.create', '{"title":"Buy milk"}']);
    expect(created.code).toBe(0);
    await runTodoCli([...dataFile, 'run', 'nav.push', '{"route":{"name":"list","params":{"listId":"inbox"}}}']);
    const screen = await runTodoCli([...dataFile, '--json', 'inspect']);
    expect(screen.json().value).toMatchObject({ route: { name: 'list' }, viewModel: { items: [{ id: created.json().value.id, title: 'Buy milk' }] } });
  });

  it('runs fixtures in memory without touching disk', async () => {
    await runTodoCli([...dataFile, '--fixture', 'demo', 'run', 'todo.create', '{"title":"ephemeral"}']);
    const todos = await runTodoCli(['--fixture', 'demo', '--json', 'run', 'todo.list', '{"listId":"inbox"}']);
    expect(todos.json().value.map((todo: { title: string }) => todo.title)).not.toContain('ephemeral');
  });

  it('reports structured errors with exit code 1', async () => {
    const invalid = await runTodoCli([...dataFile, '--json', 'run', 'todo.create', '{"title":""}']);
    expect(invalid.code).toBe(1);
    expect(invalid.json()).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    const unknown = await runTodoCli([...dataFile, 'run', 'todo.nope']);
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toContain('[unknown_action]');
  });

  it('blocks destructive agent actions until a human approves with --yes', async () => {
    const created = (await runTodoCli([...dataFile, '--json', 'run', 'todo.create', '{"title":"Temp"}'])).json().value;
    const input = JSON.stringify({ id: created.id });
    const blocked = await runTodoCli([...dataFile, '--as', 'agent:claude', '--json', 'run', 'todo.delete', input]);
    expect(blocked.json()).toMatchObject({ ok: false, error: { code: 'confirmation_required' } });
    const approved = await runTodoCli([...dataFile, '--as', 'agent:claude', '--json', 'run', 'todo.delete', input, '--yes']);
    expect(approved.json()).toMatchObject({ ok: true });
  });

  it('enforces strict UI mode with --ui-strict', async () => {
    const result = await runTodoCli(['--fixture', 'demo', '--ui-strict', 'run', 'todo.toggle', '{"id":"t_plants"}']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('[not_on_screen] todo.toggle isn\'t available on the "lists" screen');
  });

  it('rejects a malformed --as', async () => {
    const result = await runTodoCli([...dataFile, '--as', 'robot', 'inspect']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Invalid --as');
  });

  it('lists actions with JSON Schemas for agents', async () => {
    const actions = (await runTodoCli(['--json', 'actions'])).json();
    expect(actions.find((action: { name: string }) => action.name === 'todo.create')).toMatchObject({
      risk: 'write',
      inputSchema: { type: 'object', required: ['title'] },
    });
  });

  it('replays every scenario in memory, printing each step', async () => {
    const files = ['happy-path', 'agent-safety', 'undo', 'lists'].map(scenarioFile);
    const result = await runTodoCli(['run-script', ...files]);
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/▶ .*happy-path\.jsonl\n {2}✓ L3 state\.load/);
  });

  it('accepts --delay and rejects bad values', async () => {
    expect((await runTodoCli(['run-script', scenarioFile('undo'), '--delay', '5'])).code).toBe(0);
    const bad = await runTodoCli(['run-script', scenarioFile('undo'), '--delay', 'soon']);
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain('Expected milliseconds');
  });

  it('reports the failing scenario line', async () => {
    const file = join(directory, 'bad.jsonl');
    await writeFile(file, '{"run":"state.load","input":{"fixture":"demo"}}\n{"expect":"list.list","length":5}\n');
    const result = await runTodoCli(['run-script', file]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('✗ L2 list.list: expected length 5, got 2');
  });
});
