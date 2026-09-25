import { z } from 'zod';
import { defineAction } from '../../kit';
import { ListSchema } from '../../model/list';
import { listsWithCounts } from '../../queries/todos-in-list';

const CountsSchema = z.object({ all: z.number(), open: z.number(), done: z.number() });

export const listLists = defineAction({
  name: 'list.list',
  description: 'All todo lists with how many todos are open and done.',
  risk: 'read',
  input: z.object({}),
  output: z.array(ListSchema.extend({ counts: CountsSchema })),
  handler: ({ context }) => listsWithCounts(context.data()),
});
