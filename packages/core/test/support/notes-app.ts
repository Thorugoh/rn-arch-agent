import { z } from 'zod';
import { ActionError, allowIf, createAppKit } from '../../src';

/** A deliberately tiny app used to test the runtime without depending on any real app. */
const Note = z.object({ id: z.string(), text: z.string().min(1) });
type Note = z.infer<typeof Note>;

const NotesData = z.object({ notes: z.record(z.string(), Note) });
type NotesData = z.infer<typeof NotesData>;

const NotesRoute = z.discriminatedUnion('name', [
  z.object({ name: z.literal('home') }),
  z.object({ name: z.literal('note'), params: z.object({ noteId: z.string() }) }),
]);
type NotesRoute = z.infer<typeof NotesRoute>;

const { defineAction, defineScreen, defineApp } = createAppKit<NotesData, NotesRoute>();

function requireNote(data: NotesData, id: string): Note {
  const note = data.notes[id];
  if (!note) throw new ActionError('not_found', `Note "${id}" does not exist`);
  return note;
}

const addNote = defineAction({
  name: 'note.add',
  description: 'Add a note.',
  risk: 'write',
  input: z.object({ text: z.string().trim().min(1) }),
  output: Note,
  handler: ({ input, context }) => {
    const note = { id: context.newId('n_'), text: input.text };
    context.setData((data) => ({ notes: { ...data.notes, [note.id]: note } }));
    return note;
  },
  summarize: ({ input }) => `added "${input.text}"`,
  undo: ({ output }) => ({ name: 'note.remove', input: { id: output.id } }),
});

const removeNote = defineAction({
  name: 'note.remove',
  description: 'Remove a note.',
  risk: 'destructive',
  input: z.object({ id: z.string() }),
  output: z.object({ removed: Note }),
  handler: ({ input, context }) => {
    const note = requireNote(context.data(), input.id);
    context.setData((data) => ({ notes: Object.fromEntries(Object.entries(data.notes).filter(([id]) => id !== note.id)) }));
    return { removed: note };
  },
  confirmText: ({ input, data }) => `Delete "${data.notes[input.id]?.text}"?`,
  summarize: ({ output }) => `removed "${output.removed.text}"`,
  undo: ({ output }) => ({ name: 'note.restore', input: { note: output.removed } }),
});

const restoreNote = defineAction({
  name: 'note.restore',
  description: 'Put back a removed note.',
  risk: 'write',
  input: z.object({ note: Note }),
  output: Note,
  handler: ({ input, context }) => {
    if (context.data().notes[input.note.id]) throw new ActionError('conflict', `Note "${input.note.id}" already exists`);
    context.setData((data) => ({ notes: { ...data.notes, [input.note.id]: input.note } }));
    return input.note;
  },
  summarize: ({ input }) => `restored "${input.note.text}"`,
  undo: ({ output }) => ({ name: 'note.remove', input: { id: output.id } }),
});

const getNote = defineAction({
  name: 'note.get',
  description: 'Get a note.',
  risk: 'read',
  input: z.object({ id: z.string() }),
  output: Note,
  handler: ({ input, context }) => requireNote(context.data(), input.id),
});

const brokenAction = defineAction({
  name: 'note.broken',
  description: 'Writes, then fails (tests rollback).',
  risk: 'write',
  input: z.object({}),
  output: z.object({}),
  handler: ({ context }) => {
    context.setData(() => ({ notes: {} }));
    throw new Error('boom');
  },
  summarize: () => 'never',
});

const homeScreen = defineScreen({
  route: 'home',
  viewModel: ({ data }) => ({ notes: Object.values(data.notes) }),
  actions: {
    'note.add': true,
    'nav.push': ({ input, viewModel }) =>
      input.route.name === 'note'
        ? allowIf(viewModel.notes.some((note) => note.id === input.route.params.noteId), 'That note is not listed')
        : 'Home only opens notes',
  },
});

const noteScreen = defineScreen({
  route: 'note',
  viewModel: ({ data, params }) => data.notes[params.noteId] ?? { missing: true as const },
  actions: {
    'note.remove': ({ input, viewModel }) => allowIf('id' in viewModel && viewModel.id === input.id, 'This screen shows another note'),
    'nav.back': true,
  },
});

export const notesFixtures = {
  empty: (): NotesData => ({ notes: {} }),
  sample: (): NotesData => ({ notes: { n_a: { id: 'n_a', text: 'Alpha' }, n_b: { id: 'n_b', text: 'Beta' } } }),
};

export const notesApp = defineApp({
  name: 'notes',
  dataSchema: NotesData,
  routeSchema: NotesRoute,
  initialRoute: { name: 'home' },
  initialData: () => ({ notes: {} }),
  fixtures: notesFixtures,
  actions: [addNote, removeNote, restoreNote, getNote, brokenAction],
  screens: { home: homeScreen, note: noteScreen },
  routeExists: (route, data) => route.name !== 'note' || Boolean(data.notes[route.params.noteId]),
});
