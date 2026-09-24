# AGENTS.md

How to work in this repo, whether you're a coding agent or a human. The architecture is described in
[`docs/architecture-proposal.md`](docs/architecture-proposal.md) and the roadmap in
[`docs/poc-plan.md`](docs/poc-plan.md).

## The one rule: headless first

All behavior lives in `packages/core` (pure TypeScript, runs in Node). If you can't exercise
something with `npx todo` or a Vitest test, it doesn't exist yet. UI code only renders view models
and dispatches actions.

Lint enforces this: `packages/core/src` cannot import React, React Native, Expo or Node built-ins.
Platform code goes behind a port in `packages/core/src/ports.ts`, with adapters in `packages/adapters-*`.

## Repo map

| Path | What |
|---|---|
| `packages/core/src/actions/` | The action registry. It is the app's entire API: `todo.*`, `list.*`, `nav.*`, `ui.*`, `journal.*`, `app.inspect`, `state.*` |
| `packages/core/src/app.ts` | `createApp` plus the dispatch pipeline: validate → policy → confirm → execute → journal |
| `packages/core/src/screens.ts` | One `viewModel(state)` per screen. `app.inspect` returns the current one |
| `packages/core/src/nav.ts` | Navigation stack as data |
| `packages/core/src/scenario.ts` | JSONL scenario runner, shared by tests, the CLI and remote mode |
| `packages/adapters-node/` | JSON file storage, system clock, random IDs |
| `apps/cli/` | The `todo` CLI |
| `apps/mobile/` | Expo app: a thin renderer over core. See `apps/mobile/AGENTS.md` for Expo and navigation rules |
| `scenarios/*.jsonl` | Executable flows, run in CI |

## Commands

```bash
npm run check                         # lint + typecheck + all tests; run before every commit
npm run test:core                     # core tests only (~0.4s)
npx todo actions [--json]             # list actions (with JSON Schemas when --json)
npx todo describe todo.create         # one action's schemas
npx todo inspect                      # current screen: route, actions, view model
npx todo run <action> '<json>'        # dispatch; state lives in .todo/state.json
npx todo --fixture demo <cmd>         # in memory from a fixture, nothing saved
npx todo --as agent:<id> run ...      # act as an agent (destructive actions need --yes)
npx todo run-script scenarios/*.jsonl # replay scenarios (in memory unless --data)
```

Add `--json` to get a single `{ ok, value | error }` document. Errors carry a `code`
(`invalid_input`, `not_found`, `conflict`, `forbidden`, `confirmation_required`, …), and
`invalid_input` includes the action's `inputSchema`.

## Adding a feature (checkpoint loop)

1. **Plan** small slices, each named by the actions and screens it touches.
2. **Actions first.** Add or extend a `defineAction` in `packages/core/src/actions/`. Every action needs:
   - a clear `description` (agents read it as the tool description)
   - zod `input` (a top-level object) and `output`
   - a `risk`: `read`, `nav`, `write` or `destructive`
   - `summarize` for writes, `confirmText` for destructive actions, and `inverse` when it can be undone
   - a synchronous handler that validates first (throw `ActionError`) and then calls `setState`
3. **View model.** If the screen changes, update `screens.ts`. Never compute display data in React.
4. **Scenario.** Add or extend a `scenarios/*.jsonl` file. The registry test fails if any action is
   missing from every scenario.
5. **Green.** Run `npm run check`.
6. **UI** (from M3): render the view model and dispatch actions. No logic.
7. **Commit** one checkpoint at a time.

## Scenario format

```jsonl
// comments are allowed
{"run":"state.load","input":{"fixture":"demo"}}
{"run":"todo.create","input":{"title":"Buy milk"},"save":"milk"}
{"run":"todo.toggle","input":{"id":"$milk.id"}}
{"run":"todo.delete","input":{"id":"$milk.id"},"as":"agent:claude","expectError":"confirmation_required"}
{"expect":"app.inspect","path":"viewModel.items[0].done","equals":true}
{"expect":"todo.list","input":{"listId":"inbox"},"length":3}
{"expect":"app.inspect","path":"viewModel.items","contains":{"title":"Buy milk"}}
```

## Conventions and lessons learned

- Tool input schemas must be objects at the top level, because MCP requires it. Wrap unions: `nav.push` takes `{ route }`.
- Sorting must be stable, with ties keeping insertion order. Don't tie-break on random IDs.
- `DispatchMeta.confirmed` and `origin` come from the shell (a CLI flag, the UI, the MCP host), never from an agent's tool input.
- CLI commands must flush storage before exiting. `main()` already does this for every booted app.
- Always run `npm install` before `npx todo`. If the workspace bin isn't linked, npx fetches an unrelated public `todo` package.
