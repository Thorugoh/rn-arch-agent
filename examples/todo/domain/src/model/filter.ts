import { z } from 'zod';

/** Which todos list screens show. */
export const FilterSchema = z.enum(['all', 'open', 'done']);
export type Filter = z.infer<typeof FilterSchema>;
