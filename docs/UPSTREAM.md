# Upstream: Strudel

## Project identity

- **Name:** Strudel — a browser-based live coding environment for algorithmic
  music.
- **Source repository:** https://github.com/tidalcycles/strudel
- **Website:** https://strudel.cc
- **License:** AGPL-3.0-or-later
- **Authors:** Felix Roos and contributors

## Pinned version

This project depends on the published npm package `@strudel/repl` at exact
version **1.2.0** (see `package.json`). It is a direct `dependency`, not a
`devDependency`; the version is pinned exactly (no `^`/`~` range) so the app
always builds against the specific `<strudel-editor>` behavior this
integration was verified against.

## Date integration began

2026-09-02.

## Exactly which upstream objects this project touches

Every access is confined to `src/strudel/` (see `src/strudel/host.ts` for the
narrow typings and `docs/research/strudel-repl.md` for the verification memo).
Nothing outside that directory imports `@strudel/repl` internals.

| Object | What it is | Used for |
|---|---|---|
| `<strudel-editor>` custom element | Official web component, mounted top-level (no iframe) in `src/main.ts` | Hosting the live REPL |
| `host.editor` | The `StrudelMirror` instance the element creates in `connectedCallback` | Entry point to everything below |
| `host.editor.editor` | The CodeMirror 6 `EditorView` the mirror owns | Reading `state.doc`, `state.selection.main`; dispatching transactions for edits, selection, and scroll |
| `host.editor.repl` | The Strudel REPL/scheduler wrapper | `repl.evaluate()` (via `host.editor.evaluate()`), `repl.state.evalError`, `repl.scheduler.started` |
| `host.editor.evaluate()` / `.stop()` / `.toggle()` | Native Update/Stop/Play-toggle paths | `strudel_evaluate`, `strudel_play`, `strudel_stop` call these instead of reimplementing evaluation or scheduling |

The CodeMirror `EditorView`/`state` surface is stable public CM6 API. `host.editor`,
`host.editor.repl`, and `repl.state.evalError`/`repl.scheduler.started` are
internal to `@strudel/repl` (not part of a documented public contract), so they
are wrapped by the single `createStrudelAdapter()` seam in
`src/strudel/adapter.ts` rather than referenced from WebMCP tool code directly.

Also verified but deliberately **not used**: `@strudel/webaudio`'s
`getAudioContext()` is not imported separately, because doing so would create a
second `AudioContext` alongside the one `@strudel/repl` already owns internally.

## How to bump the pinned version safely

1. Re-run (or re-verify) the reconnaissance in
   `docs/research/strudel-repl.md` against the new version's bundled output
   (`node_modules/@strudel/repl/dist/*.js`), specifically the object paths in
   the table above — line numbers and internal names may move even between
   patch releases since they are unstable internals.
2. Update `"@strudel/repl"` in `package.json` to the new exact version (still
   pinned, no ranges).
3. Run `npm ci && npm run typecheck && npm test && npm run test:e2e`.
4. Manually re-run the demo flow in `docs/demo-script.md`, in particular the
   inline-slider stale-write test, since slider behavior is one of the
   internal surfaces this project depends on.
5. Record the new version and date in this file and, if any adapter code had
   to change because an internal path moved, add an entry to
   `docs/DECISIONS.md`.

## Sample-bank attribution

The default demo pattern (`src/demo-pattern.ts`) uses Strudel's own sample
loading (`prebake`), not anything vendored in this repository. See
[NOTICE.md](../NOTICE.md) for exact bank sources and their license status.
