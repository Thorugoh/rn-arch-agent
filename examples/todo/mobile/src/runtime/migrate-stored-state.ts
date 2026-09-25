/**
 * Before the runtime owned navigation and the journal, the app stored
 * `{ lists, todos, nav, ui: { filter }, journal: [{ …, inverse }] }`. This converts it to the
 * runtime's `{ data, navigation, journal }` shape so existing data survives the upgrade.
 */
type LegacyState = {
  lists: unknown;
  todos: unknown;
  nav: { stack: unknown[] };
  ui?: { filter?: string };
  journal?: Array<Record<string, unknown> & { inverse?: unknown }>;
};

export function migrateStoredState(stored: unknown): unknown {
  if (!isLegacyState(stored)) return stored;
  return {
    data: { lists: stored.lists, todos: stored.todos, filter: stored.ui?.filter ?? 'all' },
    navigation: stored.nav,
    journal: (stored.journal ?? []).map(({ inverse, ...entry }) => (inverse ? { ...entry, undo: inverse } : entry)),
  };
}

function isLegacyState(stored: unknown): stored is LegacyState {
  return typeof stored === 'object' && stored !== null && 'nav' in stored && !('data' in stored);
}
