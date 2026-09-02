# Challenge work delta

What is Strudel (upstream) versus what this challenge submission adds. None
of the items in the first list are challenge work — they are the reason this
project exists to embed, not something built here.

## Upstream (Strudel / `@strudel/repl`)

- The live coding language and its transpiler/evaluator
- The CodeMirror-based REPL editor, including the `<strudel-editor>` web
  component
- The pattern scheduler and clock
- WebAudio-based audio engine and sample loading (`prebake`)
- Inline `slider(...)` controls and their widget rendering
- Playback UI (evaluation flash, active-line/source highlighting)

## Challenge implementation (this repository)

- A live Strudel semantic adapter (`src/strudel/adapter.ts`) — the single
  seam that reads the real CodeMirror document and drives the real REPL,
  with no reimplementation of anything above
- Eight WebMCP tools (`src/webmcp/tools.ts`, `src/webmcp/schemas.ts`) built
  on that adapter
- Human/agent selection sharing (`strudel_get_context` reads the human's
  live selection; `strudel_focus_range` lets the agent set it back)
- Stale-source safety: deterministic `codeHash` (`src/strudel/revisions.ts`)
  and `STALE_CODE` rejection on every mutating call
  (`assertFresh` in `src/strudel/adapter.ts`)
- Slider-aware concurrency behavior: no separate slider bridge — inline
  slider moves are treated as ordinary document changes that invalidate
  stale agent writes, verified by a dedicated Playwright test
- WebMCP registration lifecycle (`src/webmcp/register.ts`): feature
  detection of `document.modelContext`, one-time registration, and a status
  strip that only ever reports WebMCP availability, never agent presence
- Testing: unit tests over hashing, position/offset conversion, edit
  validation, and error normalization; Playwright end-to-end tests against
  the real embedded REPL, including the stale-write and inline-slider tests
- Demo integration and challenge docs: `docs/architecture.md`,
  `docs/webmcp-tools.md`, `docs/demo-script.md`, `docs/submission.md`, this
  file, `docs/UPSTREAM.md`, `LICENSE`, and `NOTICE.md`
