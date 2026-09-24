This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Architecture (read the root `AGENTS.md` first)

This app is a **thin shell** over `@todo/core` (`packages/core`). All state, rules and navigation
live in core and run headlessly in Node; this app only renders and dispatches.

- Read screen data with `useViewModel(route)`. Never compute display data in components.
- Change anything with `useDispatch()(action, input)`. It is the same pipeline the CLI and agents use,
  tagged `origin: "user"`.
- Platform adapters (SQLite storage, IDs, clock) live in `src/ports.ts`. The confirmation sheet for
  agent-initiated destructive actions is `src/confirm.tsx` (the core `Confirmer` port).

## Navigation & Routing (overrides the Expo template default)

- **Do not use Expo Router here.** Core owns navigation (`state.nav`, driven by `nav.*` actions),
  so file-based routing would be a second source of truth. `src/Navigation.tsx` renders the core
  stack with React Navigation's native stack, which is what Expo Router uses internally:
  - core → native: `ref.reset` with a *complete* state that keeps the navigator key
  - native → core: swipe, header back and Android back become `nav.back`
  - route keys are minted per visit, because React Navigation remembers dismissed keys
- To add a screen: add the route to `packages/core/src/nav.ts`, add a view model in
  `packages/core/src/screens.ts`, register the component in `src/Navigation.tsx`, and navigate with
  `dispatch('nav.push', { route })`.

## Testing

```bash
npm run ios -w @todo/mobile          # Metro + Expo Go on the iOS simulator
maestro test apps/mobile/e2e         # UI smoke flows (run from the repo root)
```

- Give tappable elements a `testID`. Pressable rows with `accessibilityRole="button"` merge their
  children into one accessibility label, so match their text by prefix regex (`"Name.*"`).
- Prefer headless scenarios (`scenarios/*.jsonl`) for behavior. Use Maestro only for what's
  UI-specific: gestures, rendering and native navigation sync.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
