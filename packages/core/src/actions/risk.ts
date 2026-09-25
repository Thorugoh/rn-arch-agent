/**
 * How much an action can change:
 * - read        – nothing; always allowed
 * - nav         – navigation/UI state only; not journaled
 * - write       – app data; journaled, undoable when it defines `undo`
 * - destructive – loses data; agents need a human's confirmation
 */
export type Risk = 'read' | 'nav' | 'write' | 'destructive';

export function isJournaled(risk: Risk): boolean {
  return risk === 'write' || risk === 'destructive';
}
