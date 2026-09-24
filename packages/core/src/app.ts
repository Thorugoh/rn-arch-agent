import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { ActionError, type AnyAction, type ErrorCode, type Risk } from './actions/define';
import { allActions } from './actions';
import type { Origin } from './domain';
import { fixtures } from './fixtures';
import type { Ports } from './ports';
import { inspect } from './screens';
import { AppState, JOURNAL_LIMIT, type Invocation, type JournalEntry } from './state';

/** Set by the shell that owns the channel (UI, CLI, MCP), never taken from an agent's tool input. */
export type DispatchMeta = {
  origin: Origin;
  /** A human already approved this call (CLI --yes, confirm sheet, MCP elicitation). */
  confirmed?: boolean;
  /** Retries with the same key return the first result instead of running again. */
  idempotencyKey?: string;
};

export type ActionFailure = { code: ErrorCode; message: string; details?: unknown };
export type DispatchResult<T = unknown> =
  | { ok: true; value: T; entryId?: string }
  | { ok: false; error: ActionFailure };

export type PolicyDecision = { allow: true; confirm?: boolean } | { allow: false; reason: string };
export type Policy = (x: { action: AnyAction; origin: Origin; input: unknown }) => PolicyDecision;

/**
 * Humans can do anything. Agents can read, navigate and write freely (writes are
 * undoable) but destructive actions need a human's confirmation. `agentScopes`
 * optionally limits an agent to action-name patterns like "todo.*".
 */
export function defaultPolicy(agentScopes: Record<string, string[]> = {}): Policy {
  const matches = (pattern: string, name: string) =>
    pattern === '*' || pattern === name || (pattern.endsWith('.*') && name.startsWith(pattern.slice(0, -1)));
  return ({ action, origin }) => {
    if (!origin.startsWith('agent:')) return { allow: true };
    const scopes = agentScopes[origin];
    if (scopes && !scopes.some((p) => matches(p, action.name))) {
      return { allow: false, reason: `${origin} is not allowed to call ${action.name}` };
    }
    return { allow: true, confirm: action.risk === 'destructive' };
  };
}

export type ActionInfo = {
  name: string;
  description: string;
  risk: Risk;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

export function describeAction(a: AnyAction): ActionInfo {
  const opts = { unrepresentable: 'any' } as const;
  return {
    name: a.name,
    description: a.description,
    risk: a.risk,
    inputSchema: z.toJSONSchema(a.input, { ...opts, io: 'input' }) as Record<string, unknown>,
    outputSchema: z.toJSONSchema(a.output, opts) as Record<string, unknown>,
  };
}

export type CreateAppOptions = {
  ports: Ports;
  /** Used when storage is empty. Defaults to the "empty" fixture (just an Inbox). */
  initialState?: AppState;
  policy?: Policy;
  actions?: AnyAction[];
};

export type App = Awaited<ReturnType<typeof createApp>>;

export async function createApp(opts: CreateAppOptions) {
  const { ports } = opts;
  const actions = opts.actions ?? allActions;
  const policy = opts.policy ?? defaultPolicy();
  const byName = new Map(actions.map((a) => [a.name, a]));

  const stored = await ports.storage.load();
  let initial: AppState;
  if (stored == null) {
    initial = opts.initialState ?? fixtures.empty();
  } else {
    const parsed = AppState.safeParse(stored);
    if (!parsed.success) throw new Error(`Stored state is invalid:\n${z.prettifyError(parsed.error)}`);
    initial = parsed.data;
  }

  const store = createStore<AppState>()(() => initial);

  // Persist every change, in order.
  let saving: Promise<void> = Promise.resolve();
  store.subscribe((s) => {
    saving = saving.then(() => ports.storage.save(s));
  });
  if (stored == null) saving = saving.then(() => ports.storage.save(initial));

  const idempotency = new Map<string, DispatchResult>();

  function fail(code: ErrorCode, message: string, details?: unknown): DispatchResult<never> {
    return { ok: false, error: details === undefined ? { code, message } : { code, message, details } };
  }

  function unknownAction(name: string) {
    const prefix = name.split('.')[0] ?? '';
    const similar = actions.map((a) => a.name).filter((n) => n.startsWith(prefix));
    return fail('unknown_action', `Unknown action "${name}"`, { similar: similar.length ? similar : [...byName.keys()] });
  }

  /** Validates and runs a handler. Used by dispatch and by undo (ctx.run). */
  function execute(action: AnyAction, rawInput: unknown, origin: Origin, entryId: string) {
    const input = action.input.parse(rawInput ?? {});
    const output = action.handler({
      input,
      ctx: {
        getState: store.getState,
        setState: (update) => store.setState(update, true),
        now: () => ports.clock.now().toISOString(),
        ports,
        origin,
        entryId,
        run: (inv: Invocation) => {
          const inner = byName.get(inv.name);
          if (!inner) throw new ActionError('unknown_action', `Unknown action "${inv.name}"`);
          return execute(inner, inv.input, origin, entryId).output;
        },
      },
    });
    return { input, output: action.output.parse(output) };
  }

  async function dispatch<T = unknown>(name: string, rawInput: unknown, meta: DispatchMeta): Promise<DispatchResult<T>> {
    const action = byName.get(name);
    if (!action) return unknownAction(name);

    const idemKey = meta.idempotencyKey && `${meta.origin}:${name}:${meta.idempotencyKey}`;
    if (idemKey && idempotency.has(idemKey)) return idempotency.get(idemKey) as DispatchResult<T>;

    const parsed = action.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return fail('invalid_input', z.prettifyError(parsed.error), {
        issues: parsed.error.issues,
        inputSchema: describeAction(action).inputSchema,
      });
    }

    const decision = policy({ action, origin: meta.origin, input: parsed.data });
    if (!decision.allow) return fail('forbidden', decision.reason);
    if (decision.confirm && !meta.confirmed) {
      const summary = action.confirmText?.(parsed.data, store.getState()) ?? previewSummary(action, parsed.data);
      if (!ports.confirm) {
        return fail(
          'confirmation_required',
          `${action.name} is destructive and needs the user's approval: ${summary}. Ask the user, then retry with their confirmation.`,
          { action: action.name, input: parsed.data },
        );
      }
      const approved = await ports.confirm({ action: action.name, input: parsed.data, origin: meta.origin, summary });
      if (!approved) return fail('confirmation_denied', `The user declined: ${summary}`);
    }

    const before = store.getState();
    const entryId = ports.ids.next('j_');
    let result: DispatchResult<T>;
    try {
      const { input, output } = execute(action, rawInput, meta.origin, entryId);
      if (action.risk === 'write' || action.risk === 'destructive') {
        const entry: JournalEntry = {
          id: entryId,
          at: ports.clock.now().toISOString(),
          action: action.name,
          input,
          origin: meta.origin,
          summary: action.summarize?.(input, output, before) ?? action.name,
          inverse: action.inverse?.({ input, output, before }),
        };
        store.setState((s) => ({ ...s, journal: [entry, ...s.journal].slice(0, JOURNAL_LIMIT) }), true);
        result = { ok: true, value: output as T, entryId };
      } else {
        result = { ok: true, value: output as T };
      }
    } catch (e) {
      if (store.getState() !== before) store.setState(before, true); // handlers must not leave partial writes
      result =
        e instanceof ActionError
          ? fail(e.code, e.message, e.details)
          : e instanceof z.ZodError
            ? fail('internal', `Output validation failed for ${name}: ${z.prettifyError(e)}`)
            : fail('internal', e instanceof Error ? e.message : String(e));
    }

    if (idemKey && result.ok) idempotency.set(idemKey, result);
    return result;
  }

  return {
    dispatch,
    getState: store.getState,
    subscribe: (listener: (s: AppState, prev: AppState) => void) => store.subscribe(listener),
    inspect: () => inspect(store.getState()),
    describe: () => actions.map(describeAction),
    action: (name: string) => byName.get(name),
    /** Resolves once every change so far is persisted. */
    flush: () => saving,
  };
}

function previewSummary(action: AnyAction, input: unknown): string {
  const target = input && typeof input === 'object' ? JSON.stringify(input) : '';
  return `${action.name} ${target}`.trim();
}
