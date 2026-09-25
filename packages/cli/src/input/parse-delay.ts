import { InvalidArgumentError } from 'commander';

export function parseDelay(raw: string): number {
  const milliseconds = Number(raw);
  if (!Number.isInteger(milliseconds) || milliseconds < 0) throw new InvalidArgumentError('Expected milliseconds, e.g. --delay 1500');
  return milliseconds;
}
