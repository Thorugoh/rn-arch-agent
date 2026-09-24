import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/main';

const scenarios = join(import.meta.dirname, '../../../scenarios');

async function cli(...argv: string[]) {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => (out += s), stderr: (s) => (err += s) });
  return { code, out, err, json: () => JSON.parse(out) };
}

describe('todo CLI', () => {
  let dir: string;
  let data: string[];
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'todo-cli-'));
    data = ['--data', join(dir, 'state.json')];
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('persists state across separate invocations', async () => {
    const created = await cli(...data, '--json', 'run', 'todo.create', '{"title":"Buy milk"}');
    expect(created.code).toBe(0);
    const { value: todo } = created.json();

    await cli(...data, 'run', 'nav.push', JSON.stringify({ route: { name: 'list', params: { listId: 'inbox' } } }));
    const screen = await cli(...data, '--json', 'inspect');
    expect(screen.json().value).toMatchObject({
      route: { name: 'list' },
      viewModel: { items: [{ id: todo.id, title: 'Buy milk', done: false }] },
    });
  });

  it('runs from a fixture in memory without touching disk', async () => {
    await cli(...data, '--fixture', 'demo', 'run', 'todo.create', '{"title":"ephemeral"}');
    const res = await cli('--fixture', 'demo', '--json', 'run', 'todo.list', '{"listId":"inbox"}');
    expect(res.json().value.map((t: { title: string }) => t.title)).not.toContain('ephemeral');
  });

  it('reports structured errors with exit code 1', async () => {
    const res = await cli(...data, '--json', 'run', 'todo.create', '{"title":""}');
    expect(res.code).toBe(1);
    expect(res.json()).toMatchObject({ ok: false, error: { code: 'invalid_input' } });

    const human = await cli(...data, 'run', 'todo.nope');
    expect(human.code).toBe(1);
    expect(human.err).toContain('[unknown_action]');
  });

  it('enforces agent confirmation, and --yes approves', async () => {
    const created = (await cli(...data, '--json', 'run', 'todo.create', '{"title":"Temp"}')).json().value;
    const input = JSON.stringify({ id: created.id });
    const blocked = await cli(...data, '--as', 'agent:claude', '--json', 'run', 'todo.delete', input);
    expect(blocked.json()).toMatchObject({ ok: false, error: { code: 'confirmation_required' } });
    const approved = await cli(...data, '--as', 'agent:claude', '--json', 'run', 'todo.delete', input, '--yes');
    expect(approved.json()).toMatchObject({ ok: true });
  });

  it('rejects a malformed --as', async () => {
    const res = await cli(...data, '--as', 'robot', 'inspect');
    expect(res.code).toBe(1);
    expect(res.err).toContain('Invalid --as');
  });

  it('lists actions with schemas for agents', async () => {
    const res = await cli('--json', 'actions');
    const create = res.json().find((a: { name: string }) => a.name === 'todo.create');
    expect(create).toMatchObject({ risk: 'write', inputSchema: { type: 'object', required: ['title'] } });
  });

  it('replays every scenario in memory', async () => {
    const files = ['happy-path', 'agent-safety', 'undo', 'lists'].map((f) => join(scenarios, `${f}.jsonl`));
    const res = await cli('run-script', ...files);
    expect(res.err).toBe('');
    expect(res.code).toBe(0);
    expect(res.out).toContain('✓ L3 todo.create');
  });

  it('accepts --delay and rejects bad values', async () => {
    const ok = await cli('run-script', join(scenarios, 'undo.jsonl'), '--delay', '5');
    expect(ok.code).toBe(0);
    expect(ok.out).toMatch(/^▶ .*undo\.jsonl\n {2}✓ L2 state\.load/);
    const bad = await cli('run-script', join(scenarios, 'undo.jsonl'), '--delay', 'soon');
    expect(bad.code).not.toBe(0);
    expect(bad.err).toContain('Expected milliseconds');
  });

  it('fails run-script with the failing line', async () => {
    const { writeFile } = await import('node:fs/promises');
    const file = join(dir, 'bad.jsonl');
    await writeFile(file, '{"run":"state.load","input":{"fixture":"demo"}}\n{"expect":"list.list","length":5}\n');
    const res = await cli('run-script', file);
    expect(res.code).toBe(1);
    expect(res.err).toContain('✗ L2 list.list: expected length 5, got 2');
  });
});
