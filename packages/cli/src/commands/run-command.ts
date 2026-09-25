import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import { parseOrigin } from '../input/parse-origin';
import { readJsonInput } from '../input/read-json-input';
import type { Session } from '../session';

type RunOptions = { yes?: boolean; key?: string };

export function registerRunCommand(program: Command, session: Session) {
  const bin = session.config.name;
  program
    .command('run <action> [input]')
    .description('Dispatch an action. Input is JSON, or "-" to read JSON from stdin.')
    .option('-y, --yes', 'a human approves destructive actions up front')
    .option('--key <idempotencyKey>', 'retry-safe key: repeating it returns the first result')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        `  ${bin} run nav.push '{"route":{"name":"..."}}'`,
        `  ${bin} --as agent:claude run <destructive.action> '{...}' --yes`,
        `  ${bin} --remote --as agent:claude run <destructive.action> '{...}'   # the device asks the user`,
      ].join('\n'),
    )
    .action(async (name: string, rawInput: string | undefined, runOptions: RunOptions, command: Command) => {
      const options = globalOptionsOf(command);
      const input = await readJsonInput(rawInput, session.io.stdin);
      const target = await session.openTarget(options);
      const result = await target.dispatch(name, input, {
        origin: parseOrigin(options.as),
        confirmed: runOptions.yes,
        idempotencyKey: runOptions.key,
        uiStrict: options.uiStrict,
      });
      if (!session.printer(options).result(result)) session.markFailed();
    });
}
