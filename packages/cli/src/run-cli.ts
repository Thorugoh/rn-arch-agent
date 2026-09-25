import { Command, CommanderError } from 'commander';
import type { CliConfig, CliIO } from './cli-config';
import { registerActionsCommand } from './commands/actions-command';
import { registerDescribeCommand } from './commands/describe-command';
import { registerDevicesCommand } from './commands/devices-command';
import { registerInspectCommand } from './commands/inspect-command';
import { registerRunCommand } from './commands/run-command';
import { registerRunScriptCommand } from './commands/run-script-command';
import { registerScreenshotCommand } from './commands/screenshot-command';
import { registerServeCommand } from './commands/serve-command';
import { registerStateCommand } from './commands/state-command';
import { registerWatchCommand } from './commands/watch-command';
import { addGlobalOptions } from './global-options';
import { createSession } from './session';

/** Runs one CLI invocation for the configured app. Returns the exit code. */
export async function runCli(config: CliConfig, argv: string[], io: CliIO): Promise<number> {
  const session = createSession(config, io);
  const program = new Command(config.name)
    .description(`Drive the ${config.app.name} app headlessly, or the live app with --remote, the same way the UI and agents do.`)
    .configureHelp({ showGlobalOptions: true })
    .exitOverride()
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr });
  addGlobalOptions(program, config);

  for (const register of [
    registerActionsCommand,
    registerDescribeCommand,
    registerInspectCommand,
    registerStateCommand,
    registerRunCommand,
    registerRunScriptCommand,
    registerServeCommand,
    registerDevicesCommand,
    registerWatchCommand,
    registerScreenshotCommand,
  ]) {
    register(program, session);
  }

  try {
    await program.parseAsync(argv, { from: 'user' });
    return session.exitCode();
  } catch (error) {
    if (error instanceof CommanderError) return error.exitCode;
    io.stderr(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  } finally {
    await session.close();
  }
}
