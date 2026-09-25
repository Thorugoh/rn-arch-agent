import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import type { Session } from '../session';

export function registerDevicesCommand(program: Command, session: Session) {
  program
    .command('devices')
    .description('List apps connected to the relay.')
    .action(async (_options, command: Command) => {
      const options = globalOptionsOf(command);
      const devices = await (await session.openRelay(options)).devices();
      const print = session.printer(options);
      if (options.json) return print.value(devices);
      if (devices.length === 0) print.line('No app connected.');
      for (const device of devices) print.line(`${device.name.padEnd(16)} ${device.platform.padEnd(8)} since ${device.connectedAt}`);
    });
}
