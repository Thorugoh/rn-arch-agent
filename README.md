# rn-arch-agent

A proposed **agent-addressable React Native architecture**, and a todo-app proof of concept (POC) that shows it working. The goal is that **humans and AI agents use the same app through the same capability surface**:

- a person taps the UI,
- a coding agent runs and tests the app from a command line, with or without a simulator,
- a user's assistant (for example, Claude through MCP) works in the app on the person's behalf.

It is based on Shopify Engineering's [*"Back to native"*](https://shopify.engineering/back-to-native) (2026-09-10). Shopify returned to Swift and Kotlin; this project keeps React Native. What it copies is the architecture that made Shopify's agents effective:

- business logic that runs without the UI,
- a command-line tool that can inspect the app, move between screens and perform actions without touching the UI,
- a **remote mode** that drives the running app on a simulator with the same commands.

> Status: M0–M4 done (headless core, CLI, Expo app, remote mode). Next: M5, MCP for user agents.

## Quick start

```bash
npm install
npm run check                                   # lint (incl. headless guardrail) + typecheck + tests

npx todo actions                                # the app's whole API
npx todo run todo.create '{"title":"Buy milk"}' # state lives in .todo/state.json
npx todo inspect                                # current screen as JSON
npx todo --as agent:claude run todo.delete '{"id":"t_…"}'   # blocked until a human approves (--yes)
npx todo run-script scenarios/*.jsonl           # replay flows headlessly (~10ms each)

npm run ios                                     # the Expo app in the iOS simulator (Expo Go)
npm run e2e:ios                                 # Maestro UI smoke flows against it

npx todo serve                                  # relay: lets the CLI/agents drive the live app
npx todo --remote inspect                       # the simulator's current screen as JSON
npx todo --remote --as agent:claude run todo.delete '{"id":"t_…"}'   # the phone asks the user
npx todo watch                                  # live feed of every action in the app
npx todo screenshot shot.png
```

Run `npm install` before using `npx todo`. If the workspace bin isn't linked yet,
npx will fetch an unrelated public package with the same name.

## Docs

| Doc | Contents |
|---|---|
| [`docs/architecture-proposal.md`](docs/architecture-proposal.md) | Principles, layers, action registry, the three ways to reach the app, safety rules for agents, testing, trade-offs, agent development loop |
| [`docs/poc-plan.md`](docs/poc-plan.md) | POC scope, stack, milestones and demos, first code to write, success criteria |

## How it works

```
            ┌──────────────── one capability surface ────────────────┐
 humans  →  │  UI taps  ─┐                                           │
 dev agents → CLI / remote ─┼─►  Action Registry  ─►  Core (headless)  │
 user agents → MCP / in-app / OS intents ─┘                            │
            └────────────────────────────────────────────────────────┘
```

### Principles

1. **Headless first.** If a behavior can't be exercised from Node, it doesn't exist yet.
2. **Actions are the only way to change state.** The UI, the CLI, MCP and tests all call `dispatch(action, input)`.
3. **Navigation is state.** The router renders the core's route stack; it doesn't own it.
4. **Screens are projections.** Each screen has a pure `viewModel(state)`. React renders it, and agents read it as JSON.
5. **Self-describing.** Every action has a name, a description, zod schemas and a risk level. CLI help and MCP tools are generated from them.
6. **Every call records its origin** (`user`, `agent:<id>` or `system`), which gives audit, undo and permission checks.
7. **Platform code sits behind ports** (storage, clock, IDs, notifications), with small Node and React Native adapters.

### Layers

```
SHELLS        apps/mobile (Expo)  ·  apps/cli (Node)  ·  apps/mcp (Node)
CAPABILITIES  Action Registry: validate → policy → confirm → execute → journal → notify
CORE          domain · store · nav · screen view models · ports   (pure TS, no RN imports)
ADAPTERS      adapters-node (memory / file / sqlite)  ·  adapters-rn (expo-sqlite, notifications)
```

### Defining an action

```ts
export const createTodo = defineAction({
  name: 'todo.create',
  description: 'Create a todo in a list. Returns the new todo.',
  input: z.object({ listId: ListId, title: z.string().min(1), due: z.string().datetime().optional() }),
  output: Todo,
  risk: 'write',                              // 'read' | 'write' | 'destructive'
  handler: ({ input, ctx }) => ctx.store.update(s => addTodo(s, input, ctx.ids.next(), ctx.clock.now())),
});
```

### Three ways to reach the app

**1. Headless (CLI in Node).** Iterations take milliseconds and no simulator is involved.

```bash
todo run todo.create '{"listId":"inbox","title":"Buy milk"}'
todo --json inspect                           # current route + view model
todo --fixture demo inspect                   # in memory from a fixture, nothing saved
todo run-script scenarios/happy-path.jsonl    # replay and assert a whole flow
```

**2. Remote (CLI → running app).** In development builds the app dials out to a relay (`todo serve`) over JSON-RPC/WebSocket. The CLI runs the same commands against the app on a simulator or device, and the UI updates live.

```bash
todo --remote run-script scenarios/happy-path.jsonl
```

Bridge methods: `actions.list`, `actions.invoke`, `app.inspect`, `state.get` / `state.load`, `events.subscribe`, `dev.screenshot`.

**3. User agents.** An MCP server generated from the registry, running either locally or remotely against the phone. An in-app assistant and Siri / Android App Actions come later.

### Safety for agents acting on a user's behalf

- `read` actions run freely. `write` actions run and can be undone. `destructive` actions need the user's confirmation, either in the app or through an MCP elicitation.
- Every agent action is journaled with its origin and shown on an **Activity** screen with **Undo**.
- Each agent gets its own permission scope, and `idempotencyKey` prevents duplicates when an agent retries.

## Repository layout (planned)

```
rn-arch-agent/
├─ AGENTS.md                  # how agents work in this repo
├─ packages/
│  ├─ core/                   # domain, store, nav, screens, actions, ports (no RN imports, enforced by lint)
│  ├─ adapters-node/
│  ├─ adapters-rn/
│  └─ bridge/                 # JSON-RPC protocol, app host + client (platform-free), relay (node)
├─ apps/
│  ├─ mobile/                 # Expo app: renderers, NavSync, DevBridge, ConfirmSheet
│  ├─ cli/                    # `todo` binary, local + remote
│  └─ mcp/                    # MCP server built from the registry
└─ scenarios/                 # .jsonl flows shared by tests, the CLI and agents
```

## Todo-app POC

**Features:** lists, and todos you can create, rename, mark done, give a due date, delete and restore. Plus all / open / done filters and an Activity screen with Undo.

**Stack:** npm workspaces · Expo + Expo Router · `zustand/vanilla` · zod · expo-sqlite · FlashList · commander + `ws` · `@modelcontextprotocol/sdk` · Vitest + RNTL.

| Milestone | Deliverable | Demo |
|---|---|---|
| M0 Skeleton (0.5d) | Monorepo, lint rule banning RN imports in core, `AGENTS.md` | `npm run lint && npm run typecheck` ✅ |
| M1 Headless core (1.5d) | Domain, store, actions + middleware, nav, view models | `npm run test:core` ✅ (60 tests, ~0.4s) |
| M2 CLI local (1d) | `inspect`, `run`, `run-script`, scenarios in CI | `todo run-script scenarios/happy-path.jsonl` ✅ |
| M3 Mobile shell (2d) | Renderers, NavSync, expo-sqlite, Activity screen | Taps show up as `origin: user` ✅ |
| M4 Remote mode (1.5d) | Bridge, `--remote`, screenshots | The same scenario passes on the simulator and the UI updates live ✅ |
| M5 MCP (1.5d) | Registry-generated tools, confirmation policy | Headline demo (below) |
| M6 Stretch (2d) | In-app assistant using the Claude API and registry tools | The headline demo, entirely inside the app |

**Headline demo.** With the app open on the simulator, the user tells Claude: *"Add 'buy milk' and 'call mom' to my inbox, and clear everything I finished."*

1. The todos appear live in the app.
2. The delete opens a confirmation sheet on the phone.
3. The Activity screen shows each step as "Claude …", with Undo.

## Success criteria

- Every action is covered by scenarios that run in Node.
- `happy-path.jsonl` passes both headless and against the simulator, unchanged.
- A headless scenario run takes under 1s.
- `packages/core` has zero React Native imports, proven by lint.
- Destructive actions from agents always need confirmation, and every agent action can be undone.
- An agent builds one new feature working only through the CLI and tests, and a human reviews it.
