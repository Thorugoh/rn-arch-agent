import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import type { Session } from '../session';

export function registerDescribeCommand(program: Command, session: Session) {
  program
    .command('describe <action>')
    .description('Show one action with its input and output JSON Schemas.')
    .action(async (name: string, _options, command: Command) => {
      const options = globalOptionsOf(command);
      const target = await session.openTarget(options, { memoryByDefault: true });
      const action = (await target.describeActions()).find((candidate) => candidate.name === name);
      const print = session.printer(options);
      if (action) return print.value(action);
      // Let the runtime explain (it suggests similar names).
      if (!print.result(await target.dispatch(name, {}, { origin: 'system' }))) session.markFailed();
    });
}
