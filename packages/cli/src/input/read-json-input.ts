/** The action input: a JSON string, "-" to read JSON from stdin, or nothing for {}. */
export async function readJsonInput(raw: string | undefined, stdin?: NodeJS.ReadableStream): Promise<unknown> {
  if (raw === undefined) return {};
  const text = raw === '-' ? await readAll(stdin) : raw;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Input must be JSON, e.g. '{"title":"Buy milk"}'. Got: ${text}`);
  }
}

async function readAll(stream?: NodeJS.ReadableStream): Promise<string> {
  if (!stream) throw new Error('No stdin available');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
