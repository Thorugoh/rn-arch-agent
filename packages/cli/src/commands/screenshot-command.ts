import { writeFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { globalOptionsOf } from '../global-options';
import type { Session } from '../session';

export function registerScreenshotCommand(program: Command, session: Session) {
  program
    .command('screenshot <file>')
    .description('Save a PNG screenshot of the live app.')
    .action(async (file: string, _options, command: Command) => {
      const options = globalOptionsOf(command);
      const screenshot = await (await session.openRelay(options)).screenshot();
      await writeFile(file, Buffer.from(screenshot.base64, 'base64'));
      const print = session.printer(options);
      if (options.json) print.value({ file });
      else print.line(`Saved ${file}`);
    });
}
