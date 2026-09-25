import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import { parseOrigin } from '../input/parse-origin';
import type { Session } from '../session';

export function registerStateCommand(program: Command, session: Session) {
  program
    .command('state')
    .description('Dump the full app state (data, navigation, journal).')
    .action(async (_options, command: Command) => {
      const options = globalOptionsOf(command);
      const target = await session.openTarget(options);
      const result = await target.dispatch('state.get', {}, { origin: parseOrigin(options.as) });
      if (!session.printer(options).result(result)) session.markFailed();
    });
}
