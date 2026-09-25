import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import { formatEvent } from '../output/format-event';
import type { Session } from '../session';
import { waitUntilStopped } from '../wait-until-stopped';

export function registerWatchCommand(program: Command, session: Session) {
  program
    .command('watch')
    .description('Live feed of the running app: every action (taps and agents alike) and navigation.')
    .action(async (_options, command: Command) => {
      const options = globalOptionsOf(command);
      const relay = await session.openRelay(options);
      const print = session.printer(options);
      await relay.onEvent((event) => print.line(options.json ? JSON.stringify(event) : formatEvent(event)));
      if (!options.json) print.line('Watching the app. Ctrl+C to stop.');
      await waitUntilStopped(session.io.signal);
    });
}
