import { z } from 'zod';

export const Id = z.string().min(1);
export const IsoDate = z.iso.datetime();

export const List = z.object({
  id: Id,
  name: z.string().trim().min(1).max(80),
  createdAt: IsoDate,
});
export type List = z.infer<typeof List>;

export const Todo = z.object({
  id: Id,
  listId: Id,
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
  due: IsoDate.nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Todo = z.infer<typeof Todo>;

export const Filter = z.enum(['all', 'open', 'done']);
export type Filter = z.infer<typeof Filter>;

/** Who triggered a dispatch. Set by the shell (UI, CLI, MCP), never by an agent's own input. */
export type Origin = 'user' | 'system' | `agent:${string}`;
export const Origin = z
  .string()
  .regex(/^(user|system|agent:[\w.-]+)$/, 'origin must be "user", "system" or "agent:<id>"')
  .transform((s) => s as Origin);

export const INBOX_ID = 'inbox';
