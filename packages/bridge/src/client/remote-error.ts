/** A JSON-RPC error from the relay or the app, e.g. "no app connected". */
export class RemoteError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}
