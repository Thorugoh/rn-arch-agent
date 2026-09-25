import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import { parseOrigin } from '../input/parse-origin';
import type { Session } from '../session';

export function registerInspectCommand(program: Command, session: Session) {
  program
    .command('inspect')
    .description('Show the current screen: route, the actions its UI offers, and its view model.')
    .action(async (_options, command: Command) => {
      const options = globalOptionsOf(command);
      const target = await session.openTarget(options);
      const result = await target.dispatch('app.inspect', {}, { origin: parseOrigin(options.as) });
      if (!session.printer(options).result(result)) session.markFailed();
    });
}
