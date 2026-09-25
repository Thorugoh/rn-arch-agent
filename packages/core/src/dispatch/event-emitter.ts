export function createEmitter<TEvent>() {
  const listeners = new Set<(event: TEvent) => void>();
  return {
    emit: (event: TEvent) => listeners.forEach((listener) => listener(event)),
    subscribe(listener: (event: TEvent) => void): () => void {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    hasListeners: () => listeners.size > 0,
  };
}
