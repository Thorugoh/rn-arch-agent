import { z } from 'zod';

export const TodoTitleSchema = z.string().trim().min(1).max(200);
export const DueDateSchema = z.iso.datetime().nullable();

export const TodoSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  title: TodoTitleSchema,
  done: z.boolean(),
  due: DueDateSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Todo = z.infer<typeof TodoSchema>;
