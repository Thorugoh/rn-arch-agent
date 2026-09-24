import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Command, CommanderError, Option } from 'commander';
import { jsonFileStorage, randomIds, systemClock } from '@todo/adapters-node';
import {
  Origin,
  createApp,
  fixtureNames,
  fixtures,
  memoryStorage,
  originLabel,
  parseScenario,
  runScenario,
  type App,
  type Confirmer,
  type DispatchResult,
  type FixtureName,
} from '@todo/core';

export type CliIO = {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  stdin?: NodeJS.ReadableStream;
  /** A human is at the terminal, so destructive agent actions can be confirmed with a prompt. */
  interactive?: boolean;
};

type GlobalOpts = { data?: string; fixture?: FixtureName; json?: boolean; as: string };

export const DEFAULT_DATA = '.todo/state.json';

export async function main(argv: string[], io: CliIO): Promise<number> {
  let exitCode = 0;
  const booted: App[] = [];
  const print = (value: unknown, json: boolean | undefined) =>
    io.stdout(`${json ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`);

  async function boot(opts: GlobalOpts, { memoryByDefault = false } = {}): Promise<App> {
    const storage = opts.fixture
      ? memoryStorage(fixtures[opts.fixture]())
      : memoryByDefault && !opts.data
        ? memoryStorage()
        : jsonFileStorage(resolve(opts.data ?? DEFAULT_DATA));
    const app = await createApp({ ports: { storage, clock: systemClock(), ids: randomIds(), confirm: ttyConfirmer(io, opts) } });
    booted.push(app);
    return app;
  }

  function report(res: DispatchResult, json: boolean | undefined) {
    if (json) {
      print(res, true);
    } else if (res.ok) {
      print(res.value, false);
    } else {
      io.stderr(`✗ [${res.error.code}] ${res.error.message}\n`);
      if (res.error.details !== undefined) io.stderr(`${JSON.stringify(res.error.details, null, 2)}\n`);
    }
    if (!res.ok) exitCode = 1;
  }

  const program = new Command('todo')
    .description('Drive the todo app headlessly, the same way the UI and agents do.')
    .option('--data <path>', `state file (default: ${DEFAULT_DATA})`)
    .addOption(new Option('--fixture <name>', 'run in memory from a fixture; nothing is saved').choices(fixtureNames))
    .option('--json', 'machine-readable output (one JSON document)')
    .option('--as <origin>', 'who is acting: user | system | agent:<id>', 'user')
    .configureHelp({ showGlobalOptions: true })
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr });

  program
    .command('actions')
    .description('List every action (the app’s whole API). With --json, includes input/output JSON Schemas.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const app = await boot(opts, { memoryByDefault: true });
      const actions = app.describe();
      if (opts.json) return print(actions, true);
      const width = Math.max(...actions.map((a) => a.name.length));
      for (const a of actions) io.stdout(`${a.name.padEnd(width)}  ${a.risk.padEnd(11)}  ${a.description}\n`);
    });

  program
    .command('describe <action>')
    .description('Show one action with its input and output JSON Schemas.')
    .action(async (name: string, _o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const app = await boot(opts, { memoryByDefault: true });
      const info = app.describe().find((a) => a.name === name);
      if (!info) return report(await app.dispatch(name, {}, { origin: 'system' }), opts.json);
      print(info, opts.json);
    });

  program
    .command('inspect')
    .description('Show the current screen: route, available actions and view model.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const app = await boot(opts);
      report(await app.dispatch('app.inspect', {}, { origin: parseOrigin(opts.as) }), opts.json);
    });

  program
    .command('state')
    .description('Dump the full app state.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const app = await boot(opts);
      report(await app.dispatch('state.get', {}, { origin: parseOrigin(opts.as) }), opts.json);
    });

  program
    .command('run <action> [input]')
    .description('Dispatch an action. Input is JSON, or "-" to read JSON from stdin.')
    .option('-y, --yes', 'a human approves destructive actions up front')
    .option('--key <idempotencyKey>', 'retry-safe key: repeating it returns the first result')
    .addHelpText('after', `\nExamples:\n  todo run todo.create '{"title":"Buy milk"}'\n  todo --as agent:claude run todo.delete '{"id":"t_1"}' --yes`)
    .action(async (name: string, rawInput: string | undefined, local: { yes?: boolean; key?: string }, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const input = await parseInput(rawInput, io);
      const app = await boot(opts);
      const res = await app.dispatch(name, input, {
        origin: parseOrigin(opts.as),
        confirmed: local.yes,
        idempotencyKey: local.key,
      });
      report(res, opts.json);
    });

  program
    .command('run-script <files...>')
    .description('Replay JSONL scenarios and check their expectations. Runs in memory unless --data is given.')
    .action(async (files: string[], _o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const app = await boot(opts, { memoryByDefault: true });
      const results = [];
      for (const file of files) {
        const started = performance.now();
        const report = await runScenario(parseScenario(await readFile(file, 'utf8')), app.dispatch, {
          origin: parseOrigin(opts.as),
        });
        const ms = Math.round(performance.now() - started);
        results.push({ file, ms, ...report });
        if (!report.ok) exitCode = 1;
        if (opts.json) continue;
        io.stdout(`${report.ok ? '✓' : '✗'} ${file} (${ms}ms)\n`);
        for (const s of report.steps) {
          const line = `  ${s.ok ? '✓' : '✗'} L${s.line} ${s.message}\n`;
          if (s.ok) io.stdout(line);
          else io.stderr(line);
        }
      }
      if (opts.json) print(results, true);
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode;
    io.stderr(`✗ ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  } finally {
    // Every command may have written (even `inspect` seeds new storage): finish before returning.
    await Promise.all(booted.map((a) => a.flush()));
  }
  return exitCode;
}

function parseOrigin(raw: string): Origin {
  const parsed = Origin.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid --as "${raw}": use user, system or agent:<id>`);
  return parsed.data;
}

async function parseInput(raw: string | undefined, io: CliIO): Promise<unknown> {
  if (raw === undefined) return {};
  let text = raw;
  if (raw === '-') {
    if (!io.stdin) throw new Error('No stdin available');
    const chunks: Buffer[] = [];
    for await (const chunk of io.stdin) chunks.push(Buffer.from(chunk));
    text = Buffer.concat(chunks).toString('utf8');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Input must be JSON, e.g. '{"title":"Buy milk"}'. Got: ${text}`);
  }
}

/** When a person is at the terminal, destructive agent actions ask them first. */
function ttyConfirmer(io: CliIO, opts: GlobalOpts): Confirmer | undefined {
  if (!io.interactive || opts.json || !io.stdin) return undefined;
  const input = io.stdin;
  return async (req) => {
    const rl = createInterface({ input, output: process.stderr });
    try {
      const answer = await rl.question(`? ${originLabel(req.origin)} wants to: ${req.summary} [y/N] `);
      return /^y(es)?$/i.test(answer.trim());
    } finally {
      rl.close();
    }
  };
}
