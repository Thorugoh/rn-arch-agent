import { z } from 'zod';

export const INBOX_ID = 'inbox';

export const ListSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  createdAt: z.iso.datetime(),
});
export type List = z.infer<typeof ListSchema>;
