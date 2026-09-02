# Strudel WebMCP

> Live-code together.

Strudel WebMCP progressively enhances the normal Strudel browser REPL with
semantic tools for the browser agent already accompanying the user.

The human can type, select code, move inline sliders, and perform normally.
The agent can read and edit that exact same CodeMirror document and evaluate
changes in the same live Strudel scheduler.

No AI SDK.
No MCP server.
No WebSocket bridge.
No session ID.

![Strudel WebMCP playing the seed groove, with inline sliders live in the editor](./docs/screenshot.png)

## Why WebMCP

|                      | Strudel MCP bridge       | Strudel WebMCP           |
|----------------------|---------------------------|---------------------------|
| Setup                | configure connector       | open page                 |
| Bridge               | MCP + websocket/SSE       | none                      |
| Session identity     | often explicit ID         | current browser tab       |
| Editor               | synchronized copy/UI      | exact live editor         |
| Human slider changes | synchronization layer     | already same source       |
| Runtime              | bridged session           | exact current REPL        |
| AI embedded          | maybe                     | never                     |

This doesn't mean agent control of Strudel was impossible before — existing
MCP-based Strudel projects already show it can be done. The difference is what
this integration requires to work: opening the page, nothing else.

## What the agent can do

Eight WebMCP tools, all operating on the visible editor the human sees:

- `strudel_get_context` — read live playback state, cursor, and current human selection.
- `strudel_get_code` — read the exact current (possibly unsaved) source, optionally by line range.
- `strudel_apply_edits` — atomically replace one or more ranges of the visible source.
- `strudel_replace_code` — replace the entire visible source.
- `strudel_evaluate` — run Strudel's native Update on the visible source, live.
- `strudel_play` — start playback via the native play path.
- `strudel_stop` — stop playback via the native stop/hush path.
- `strudel_focus_range` — select and scroll to a range so the human sees what the agent means.

Full input/output/error details: [docs/webmcp-tools.md](./docs/webmcp-tools.md).

## Try it

Live site: **https://alliecatowo.github.io/strudel-webmcp/**

This requires a WebMCP-capable browser or agent (for example Chrome 149+ or
Edge 150+ with the WebMCP origin trial, or ChatGPT Desktop) to exercise the
agent tools. Without one, the page is still a completely normal, fully
functional Strudel REPL — WebMCP is a progressive enhancement, not a
requirement.

## Run locally

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run dev       # local dev server
npm run preview   # preview a production build
```

## How it works

```
┌─────────────────────────────────────┐
│            Browser tab              │
│                                     │
│    <strudel-editor>                 │
│         │                           │
│         ├── CodeMirror document ◄── HUMAN
│         │        │                  │
│         │        ├── selection      │
│         │        └── sliders        │
│         │                           │
│         └── Strudel REPL            │
│              │                      │
│              └── scheduler/audio    │
│                                     │
│         ↕                           │
│   StrudelAdapter                    │
│         ↕                           │
│   WebMCP tools                      │
│         ↕                           │
│ document.modelContext               │
└──────────────┬──────────────────────┘
               │
               ▼
      compatible browser agent
```

There is one source of truth: the visible CodeMirror document. The adapter
(`src/strudel/adapter.ts`) reads it fresh on every call and stale-write guards
every mutation with a `codeHash`, so a human edit — including moving an inline
slider — always beats an agent write made from an older read. See
[docs/architecture.md](./docs/architecture.md) for the full data-flow
breakdown.

## Tests

- `npm test` — unit tests (Vitest): hashing, position/offset conversion, edit
  validation, stale-hash rejection, source-size bounds, error normalization.
- `npm run test:e2e` — Playwright end-to-end tests against the real
  `<strudel-editor>`, including the inline-slider stale-write test.

## Repository layout

```
src/
  main.ts            # app shell, mounts <strudel-editor>, wires transport + WebMCP
  demo-pattern.ts     # seed composition
  strudel/            # the adapter seam — the only code that touches @strudel/repl internals
  webmcp/             # tool definitions, schemas, registration, error/result helpers
  ui/                 # small WebMCP status strip
docs/
  BUILD_CONTRACT.md   # authoritative implementation spec
  DECISIONS.md         # recorded deviations from the contract, if any
  UPSTREAM.md          # Strudel version, license, touched objects
  architecture.md
  webmcp-tools.md
  demo-script.md
  submission.md
  CHALLENGE_DELTA.md
  research/            # scout memos on pinned Strudel internals and WebMCP
tests/
  unit/, e2e/, webmcp-shim.ts   # test-only WebMCP shim, never shipped
```

## License

AGPL-3.0-only. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).

Built on Strudel, the browser-based live coding environment for algorithmic
music.
