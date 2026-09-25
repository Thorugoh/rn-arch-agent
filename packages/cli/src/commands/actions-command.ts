import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import type { Session } from '../session';

export function registerActionsCommand(program: Command, session: Session) {
  program
    .command('actions')
    .description('List every action: the app’s whole API. With --json, includes input/output JSON Schemas.')
    .action(async (_options, command: Command) => {
      const options = globalOptionsOf(command);
      const target = await session.openTarget(options, { memoryByDefault: true });
      const actions = await target.describeActions();
      const print = session.printer(options);
      if (options.json) return print.value(actions);
      const width = Math.max(...actions.map((action) => action.name.length));
      for (const action of actions) print.line(`${action.name.padEnd(width)}  ${action.risk.padEnd(11)}  ${action.description}`);
    });
}
