import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Command, CommanderError, InvalidArgumentError, Option } from 'commander';
import { jsonFileStorage, randomIds, systemClock } from '@todo/adapters-node';
import { DEFAULT_RELAY_PORT, DEFAULT_RELAY_URL, connectRelay, type BridgeEvent, type RelayClient } from '@todo/bridge';
import { startRelay, type RelayLogEvent } from '@todo/bridge/server';
import {
  Origin,
  createApp,
  fixtureNames,
  fixtures,
  memoryStorage,
  originLabel,
  parseScenario,
  runScenario,
  type ActionInfo,
  type App,
  type Confirmer,
  type Dispatch,
  type DispatchResult,
  type FixtureName,
} from '@todo/core';

export type CliIO = {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  stdin?: NodeJS.ReadableStream;
  /** A human is at the terminal, so destructive agent actions can be confirmed with a prompt. */
  interactive?: boolean;
  /** Ends long-running commands (serve, watch). Defaults to SIGINT/SIGTERM. */
  signal?: AbortSignal;
};

type GlobalOpts = {
  data?: string;
  fixture?: FixtureName;
  json?: boolean;
  as: string;
  remote?: boolean;
  device?: string;
  relay: string;
  token?: string;
};

/** What commands run against: an in-process app, or the live app through the relay. */
type Target = { dispatch: Dispatch; describe(): Promise<ActionInfo[]>; remote?: RelayClient };

export const DEFAULT_DATA = '.todo/state.json';

export async function main(argv: string[], io: CliIO): Promise<number> {
  let exitCode = 0;
  const localApps: App[] = [];
  const remotes: RelayClient[] = [];
  const print = (value: unknown, json: boolean | undefined) =>
    io.stdout(`${json ? JSON.stringify(value) : JSON.stringify(value, null, 2)}\n`);

  async function connect(opts: GlobalOpts): Promise<RelayClient> {
    const client = await connectRelay(opts.relay, {
      target: opts.device,
      token: opts.token,
    });
    remotes.push(client);
    return client;
  }

  async function boot(opts: GlobalOpts, { memoryByDefault = false } = {}): Promise<Target> {
    if (opts.remote || opts.device) {
      const client = await connect(opts);
      return { dispatch: client.dispatch, describe: client.describe, remote: client };
    }
    const storage = opts.fixture
      ? memoryStorage(fixtures[opts.fixture]())
      : memoryByDefault && !opts.data
        ? memoryStorage()
        : jsonFileStorage(resolve(opts.data ?? DEFAULT_DATA));
    const app = await createApp({ ports: { storage, clock: systemClock(), ids: randomIds(), confirm: ttyConfirmer(io, opts) } });
    localApps.push(app);
    return { dispatch: app.dispatch, describe: async () => app.describe() };
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

  const untilStopped = () =>
    new Promise<void>((done) => {
      if (io.signal) {
        if (io.signal.aborted) return done();
        io.signal.addEventListener('abort', () => done(), { once: true });
        return;
      }
      process.once('SIGINT', () => done());
      process.once('SIGTERM', () => done());
    });

  const program = new Command('todo')
    .description('Drive the todo app headlessly, or the live app with --remote, the same way the UI and agents do.')
    .option('--data <path>', `state file (default: ${DEFAULT_DATA})`)
    .addOption(new Option('--fixture <name>', 'run in memory from a fixture; nothing is saved').choices(fixtureNames))
    .option('--json', 'machine-readable output (one JSON document)')
    .option('--as <origin>', 'who is acting: user | system | agent:<id>', 'user')
    .option('--remote', 'run against the live app through the relay (todo serve)')
    .addOption(new Option('--device <name>', 'which connected app to target (name or prefix); needed only when several are connected').env('TODO_DEVICE'))
    .addOption(new Option('--relay <url>', 'relay URL').env('TODO_RELAY_URL').default(DEFAULT_RELAY_URL))
    .addOption(new Option('--token <token>', 'relay pairing token').env('TODO_RELAY_TOKEN'))
    .configureHelp({ showGlobalOptions: true })
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr });

  program
    .command('actions')
    .description('List every action (the app’s whole API). With --json, includes input/output JSON Schemas.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const target = await boot(opts, { memoryByDefault: true });
      const actions = await target.describe();
      if (opts.json) return print(actions, true);
      const width = Math.max(...actions.map((a) => a.name.length));
      for (const a of actions) io.stdout(`${a.name.padEnd(width)}  ${a.risk.padEnd(11)}  ${a.description}\n`);
    });

  program
    .command('describe <action>')
    .description('Show one action with its input and output JSON Schemas.')
    .action(async (name: string, _o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const target = await boot(opts, { memoryByDefault: true });
      const info = (await target.describe()).find((a) => a.name === name);
      if (!info) return report(await target.dispatch(name, {}, { origin: 'system' }), opts.json);
      print(info, opts.json);
    });

  program
    .command('inspect')
    .description('Show the current screen: route, available actions and view model.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const target = await boot(opts);
      report(await target.dispatch('app.inspect', {}, { origin: parseOrigin(opts.as) }), opts.json);
    });

  program
    .command('state')
    .description('Dump the full app state.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const target = await boot(opts);
      report(await target.dispatch('state.get', {}, { origin: parseOrigin(opts.as) }), opts.json);
    });

  program
    .command('run <action> [input]')
    .description('Dispatch an action. Input is JSON, or "-" to read JSON from stdin.')
    .option('-y, --yes', 'a human approves destructive actions up front')
    .option('--key <idempotencyKey>', 'retry-safe key: repeating it returns the first result')
    .addHelpText(
      'after',
      `\nExamples:\n  todo run todo.create '{"title":"Buy milk"}'\n  todo --as agent:claude run todo.delete '{"id":"t_1"}' --yes\n  todo --remote --as agent:claude run todo.delete '{"id":"t_1"}'   # the phone asks the user`,
    )
    .action(async (name: string, rawInput: string | undefined, local: { yes?: boolean; key?: string }, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const input = await parseInput(rawInput, io);
      const target = await boot(opts);
      if (target.remote && !opts.json && io.interactive) io.stderr('… running on the device\n');
      const res = await target.dispatch(name, input, {
        origin: parseOrigin(opts.as),
        confirmed: local.yes,
        idempotencyKey: local.key,
      });
      report(res, opts.json);
    });

  program
    .command('run-script <files...>')
    .description('Replay JSONL scenarios and check their expectations. Local runs are in memory unless --data is given.')
    .option('--delay <ms>', 'pause between actions, to watch them happen in the live app (use with --remote)', parseDelay)
    .addHelpText('after', '\nExample:\n  todo --remote run-script scenarios/happy-path.jsonl --delay 1500')
    .action(async (files: string[], local: { delay?: number }, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const target = await boot(opts, { memoryByDefault: true });
      const results = [];
      for (const file of files) {
        if (!opts.json) io.stdout(`▶ ${file}${target.remote ? ' (remote)' : ''}\n`);
        const started = performance.now();
        const report = await runScenario(parseScenario(await readFile(file, 'utf8')), target.dispatch, {
          origin: parseOrigin(opts.as),
          delayMs: local.delay,
          // Print each step as it finishes, so the terminal keeps pace with the screen.
          onStep: (s) => {
            if (opts.json) return;
            const line = `  ${s.ok ? '✓' : '✗'} L${s.line} ${s.message}\n`;
            if (s.ok) io.stdout(line);
            else io.stderr(line);
          },
        });
        const ms = Math.round(performance.now() - started);
        results.push({ file, ms, ...report });
        if (!report.ok) exitCode = 1;
        if (!opts.json) io.stdout(`${report.ok ? '✓' : '✗'} ${file} (${ms}ms)\n`);
      }
      if (opts.json) print(results, true);
    });

  program
    .command('serve')
    .description('Run the relay that connects the CLI and agents to the live app (dev only).')
    .option('--port <port>', 'port to listen on', String(DEFAULT_RELAY_PORT))
    .option('--host <host>', 'interface to bind; use 0.0.0.0 for physical devices (requires --token)', '127.0.0.1')
    .action(async (local: { port: string; host: string }, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const loopback = local.host === '127.0.0.1' || local.host === 'localhost' || local.host === '::1';
      if (!loopback && !opts.token) throw new Error(`Binding to ${local.host} exposes the app to the network: pass --token <secret>`);
      const relay = await startRelay({
        port: Number(local.port),
        host: local.host,
        token: opts.token,
        log: (e) => {
          const line = opts.json ? JSON.stringify(e) : formatRelayLog(e);
          if (line) io.stdout(`${line}\n`);
        },
      });
      if (!opts.json) {
        io.stdout(`Relay listening on ws://${relay.host}:${relay.port}${opts.token ? ' (token required)' : ''}\n`);
        io.stdout('Waiting for the app (npm run ios). Ctrl+C to stop.\n');
      }
      await untilStopped();
      await relay.close();
    });

  program
    .command('devices')
    .description('List apps connected to the relay.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const devices = await (await connect(opts)).devices();
      if (opts.json) return print(devices, true);
      if (!devices.length) io.stdout('No app connected.\n');
      for (const d of devices) io.stdout(`${d.name.padEnd(16)} ${d.platform.padEnd(8)} since ${d.connectedAt}\n`);
    });

  program
    .command('watch')
    .description('Stream what happens in the live app: every action (taps and agents alike) and navigation.')
    .action(async (_o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const client = await connect(opts);
      await client.subscribe((e) => io.stdout(`${opts.json ? JSON.stringify(e) : formatEvent(e)}\n`));
      if (!opts.json) io.stdout('Watching the app. Ctrl+C to stop.\n');
      await untilStopped();
    });

  program
    .command('screenshot <file>')
    .description('Save a PNG screenshot of the live app.')
    .action(async (file: string, _o, cmd: Command) => {
      const opts = cmd.optsWithGlobals<GlobalOpts>();
      const shot = await (await connect(opts)).screenshot();
      await writeFile(file, Buffer.from(shot.base64, 'base64'));
      if (opts.json) print({ file }, true);
      else io.stdout(`Saved ${file}\n`);
    });

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode;
    io.stderr(`✗ ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  } finally {
    // Every local command may have written (even `inspect` seeds new storage): finish before returning.
    await Promise.all(localApps.map((a) => a.flush()));
    remotes.forEach((r) => r.close());
  }
  return exitCode;
}

const time = (iso: string) => iso.slice(11, 19);

export function formatEvent(e: BridgeEvent): string {
  if (e.type === 'device') return `${time(e.at)}  ${e.device}  ${e.status === 'connected' ? '● connected' : '○ disconnected'}`;
  if (e.type === 'nav') {
    const params = 'params' in e.route ? ` ${JSON.stringify(e.route.params)}` : '';
    return `${time(e.at)}  ${e.device}  ↪ ${e.route.name}${params}`;
  }
  const who = originLabel(e.origin).padEnd(8);
  const outcome = e.ok ? `✓${e.summary ? ` ${who.trim()} ${e.summary}` : ''}` : `✗ ${e.code}`;
  return `${time(e.at)}  ${e.device}  ${who} ${e.name.padEnd(14)} ${outcome}`;
}

function formatRelayLog(e: RelayLogEvent): string | undefined {
  switch (e.type) {
    case 'device':
      return `${e.status === 'connected' ? '●' : '○'} ${e.device.name} (${e.device.platform}) ${e.status}`;
    case 'rejected':
      return `✗ rejected a connection: ${e.reason}`;
    case 'event':
      return e.event.type === 'device' ? undefined : formatEvent(e.event);
    default:
      return undefined;
  }
}

function parseDelay(raw: string): number {
  const ms = Number(raw);
  if (!Number.isInteger(ms) || ms < 0) throw new InvalidArgumentError('Expected milliseconds, e.g. --delay 1500');
  return ms;
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

/** When a person is at the terminal, destructive agent actions ask them first (local mode only). */
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
