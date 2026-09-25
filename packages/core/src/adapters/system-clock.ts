import type { Clock } from '../foundation/ports';

export const systemClock = (): Clock => ({ now: () => new Date() });
