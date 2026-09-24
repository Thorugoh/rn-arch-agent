import { main } from './main';

process.exitCode = await main(process.argv.slice(2), {
  stdout: (s) => process.stdout.write(s),
  stderr: (s) => process.stderr.write(s),
  stdin: process.stdin,
  interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
});
