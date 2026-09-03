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
narrow typings). Nothing outside that directory imports `@strudel/repl`
internals.

| Object | What it is | Used for |
|---|---|---|
| `<strudel-editor>` custom element | Official web component, mounted top-level (no iframe) in `src/main.ts` | Hosting the live REPL |
| `host.editor` | The `StrudelMirror` instance the element creates in `connectedCallback` | Entry point to everything below |
| `host.editor.editor` | The CodeMirror 6 `EditorView` the mirror owns | Reading `state.doc`, `state.selection.main`; dispatching transactions for edits, selection, and scroll |
| `host.editor.repl` | The Strudel REPL/scheduler wrapper | `repl.evaluate()` (via `host.editor.evaluate()`), `repl.state.evalError`, `repl.scheduler.started` |
| `host.editor.evaluate()` / `.stop()` / `.toggle()` | Native Update/Stop/Play-toggle paths | `strudel_evaluate`, `strudel_play`, `strudel_stop` call these instead of reimplementing evaluation or scheduling |
| `host.editor.repl.evaluate(code)` | The REPL's inner evaluate for a code string | Solo and audition (`src/strudel/adapter.ts` `evaluateDerived`): evaluates a range of the visible source (space-padded to preserve offsets) or a proposal's derived code. This is the same function `host.editor.evaluate()` itself calls with the document text |
| `host.editor.flash()` | The mirror's evaluation-flash indicator | Fired when derived (solo/audition) evaluation runs, so the human sees the same visual cue as a normal Update |
| `host.editor.updateSettings({ theme })` | The mirror's settings path (persisted through Strudel's own editor-settings store) | `strudel_set_theme` |
| `host.editor.drawer.visibleHaps` | The pattern-drawer's currently drawn haps | `sounding` in `strudel_get_context`: source ranges whose events are active right now (`hap.isActive(now)` with `hap.context.locations`), only while the evaluated code matches the document |
| `AudioNode.prototype.connect` | Platform (WebAudio) prototype, not Strudel | The master-output tap (`src/strudel/audio-tap.ts` `MasterTap.install`) wraps `connect` once at startup to mirror every connection to `context.destination` into a per-context `GainNode`, so recording hears exactly what the human hears. Risk note: this is the one platform prototype this app patches. The patch is additive-only — it calls the original `connect` unchanged and mirrors best-effort in a try/catch — and it is installed before Strudel builds its (lazy) audio graph. A future Strudel that routes audio through a `AudioWorkletNode` off the destination, or an engine change away from WebAudio, would make the tap see nothing and `strudel_record` would report `RECORDING_UNSUPPORTED`/`NOT_PLAYING` rather than record silence-by-accident |
| evalScope'd globals: `samples`, `soundMap` | Strudel's user-facing sample loader and sound registry (the same globals pattern code calls) | `strudel_load_samples` and `strudel_list_sounds` (`src/strudel/sounds.ts`) — never an agent-side copy of the registry |
| evalScope'd global: `analysers` | The `AnalyserNode` map Strudel keeps for `.analyze("id")` patterns | Per-voice recording (`resolveAnalyser` in `src/strudel/audio-tap.ts`) |
| evalScope'd global: `codemirrorSettings` | Strudel's persisted editor-settings store | Reading the current theme for `strudel_get_context` (`currentTheme` in `src/strudel/adapter.ts`) |
| evalScope'd global: `getAudioContext` | Strudel's own AudioContext accessor | Preferring Strudel's context when picking the tap's active context (see below) |
| evalScope'd global: `themes` | Theme-name map exported by `@strudel/codemirror` | The valid theme list for `strudel_set_theme` (read once in `src/main.ts`, with a verified fallback list) |

The CodeMirror `EditorView`/`state` surface is stable public CM6 API. `host.editor`,
`host.editor.repl`, `repl.state.evalError`/`repl.scheduler.started`,
`repl.evaluate(code)`, `flash()`, `updateSettings()`, and `drawer.visibleHaps`
are internal to `@strudel/repl` (not part of a documented public contract), so
they are wrapped by the single `createStrudelAdapter()` seam in
`src/strudel/adapter.ts` rather than referenced from WebMCP tool code
directly. The evalScope'd globals (`samples`, `soundMap`, `analysers`,
`codemirrorSettings`, `themes`, `getAudioContext`) are user-facing by design —
pattern code itself calls them — but are likewise reached only through
`src/strudel/` modules; `src/main.ts` reads only the `themes` name list.

Also verified and used only read-only: Strudel's evalScope'd
`getAudioContext()` global is called (never imported from
`@strudel/webaudio`, which would construct a second `AudioContext`) just to
prefer Strudel's own context when the tap picks the active one.

## Host-page UI surfaces investigated (none reusable)

The pinned component (`node_modules/@strudel/repl/repl-component.mjs`, the
whole element definition) exposes no surrounding UI to reuse: no transport
buttons (only the Ctrl+Enter / Ctrl+. shortcuts), no settings/theme panel
(themes go through `updateSettings`, which `strudel_set_theme` already uses),
no sample browser or import surface (the full strudel.cc IDE has one; the
embeddable component does not), no slots or panels. Every custom surface on
this page (transport, record/takes, samples, versions, proposal bar,
solo/audition notice, mode dial) therefore exists because there is no native
equivalent. If a future `@strudel/repl` ships any of these natively, the
corresponding custom surface should be deleted in favour of it.

## How to bump the pinned version safely

1. Re-verify the object paths in the table above against the new version's
   bundled output (`node_modules/@strudel/repl/dist/*.js`) — line numbers and
   internal names may move even between patch releases since they are
   unstable internals.
2. Update `"@strudel/repl"` in `package.json` to the new exact version (still
   pinned, no ranges).
3. Run `npm ci && npm run typecheck && npm test && npm run test:e2e`.
4. Manually re-run the demo flow, in particular the inline-slider stale-write
   test, since slider behavior is one of the internal surfaces this project
   depends on.
5. Record the new version and date in this file.

## Sample-bank attribution

The default demo pattern (`src/demo-pattern.ts`) uses Strudel's own sample
loading (`prebake`), not anything vendored in this repository. See
[NOTICE.md](../NOTICE.md) for exact bank sources and their license status.
