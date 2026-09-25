import { z } from 'zod';
import { defineAction } from '../kit';
import { FilterSchema } from '../model/filter';

export const setFilter = defineAction({
  name: 'ui.setFilter',
  description: 'Choose which todos list screens show: all, open or done.',
  risk: 'nav',
  input: z.object({ filter: FilterSchema }),
  output: z.object({ filter: FilterSchema }),
  handler: ({ input, context }) => {
    context.setData((data) => ({ ...data, filter: input.filter }));
    return { filter: input.filter };
  },
});
