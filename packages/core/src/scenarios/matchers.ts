import type { ExpectStep } from './scenario-step';

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => deepEqual((a as never)[key], (b as never)[key]));
}

/** Every field of `expected` matches the same field of `actual`. */
function matchesFields(expected: unknown, actual: unknown): boolean {
  if (!expected || typeof expected !== 'object' || !actual || typeof actual !== 'object') return false;
  return Object.entries(expected).every(([key, value]) => deepEqual((actual as Record<string, unknown>)[key], value));
}

function contains(actual: unknown, needle: unknown): boolean {
  if (Array.isArray(actual)) return actual.some((item) => deepEqual(item, needle) || matchesFields(needle, item));
  return typeof actual === 'string' && typeof needle === 'string' && actual.includes(needle);
}

const show = (value: unknown) => JSON.stringify(value);

/** null when the expectation holds, otherwise what went wrong. */
export function checkExpectation(step: ExpectStep, actual: unknown, expected: { equals?: unknown; contains?: unknown }): string | null {
  if ('equals' in step && !deepEqual(actual, expected.equals)) {
    return `expected ${show(expected.equals)}, got ${show(actual)}`;
  }
  if (step.length !== undefined && (!Array.isArray(actual) || actual.length !== step.length)) {
    return `expected length ${step.length}, got ${Array.isArray(actual) ? actual.length : show(actual)}`;
  }
  if ('contains' in step && !contains(actual, expected.contains)) {
    return `expected to contain ${show(expected.contains)}, got ${show(actual)}`;
  }
  return null;
}
