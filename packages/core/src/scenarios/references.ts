/** "viewModel.items[0].title" → the value at that path, or undefined. */
export function readPath(value: unknown, path: string | undefined): unknown {
  if (!path) return value;
  const keys = path.match(/[^.[\]]+/g) ?? [];
  return keys.reduce<unknown>((current, key) => (current == null ? undefined : (current as Record<string, unknown>)[key]), value);
}

/** Replaces "$name.path" strings (anywhere in the value) with saved outputs. */
export function resolveReferences(value: unknown, saved: Map<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('$')) {
    const [name, ...path] = value.slice(1).split('.');
    return name && saved.has(name) ? readPath(saved.get(name), path.join('.')) : value;
  }
  if (Array.isArray(value)) return value.map((item) => resolveReferences(item, saved));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveReferences(item, saved)]));
  }
  return value;
}
