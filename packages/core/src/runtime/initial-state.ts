import { startAt } from '../navigation/navigation-stack';
import type { AnyAppDefinition } from './app-definition';
import type { RuntimeState } from './runtime-state';

/** A fresh state around the given data: at the initial route, with an empty journal. */
export function freshState(definition: AnyAppDefinition, data: unknown = definition.initialData()): RuntimeState {
  return { data, navigation: startAt(definition.initialRoute), journal: [] };
}
