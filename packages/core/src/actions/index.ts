import { appActions } from './app';
import type { AnyAction } from './define';
import { listActions } from './list';
import { todoActions } from './todo';

/** The app's entire public API. UI, CLI, MCP and tests all go through these. */
export const allActions: AnyAction[] = [...listActions, ...todoActions, ...appActions];

export * from './define';
