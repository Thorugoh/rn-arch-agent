/** Resolves when the signal aborts, or on Ctrl+C / SIGTERM when there is no signal. */
export function waitUntilStopped(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal) {
      if (signal.aborted) return resolve();
      signal.addEventListener('abort', () => resolve(), { once: true });
      return;
    }
    process.once('SIGINT', () => resolve());
    process.once('SIGTERM', () => resolve());
  });
}
