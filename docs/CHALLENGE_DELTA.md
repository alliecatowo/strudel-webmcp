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
- Thirteen WebMCP tools (`src/webmcp/tools.ts`, `src/webmcp/schemas.ts`)
  built on that adapter — the original eight (read, edit, replace,
  evaluate, play, stop, focus) plus the v2 wave below
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

## v2 feature wave

Everything in this section is challenge work on top of upstream Strudel
(which ships none of it):

- Agent permission modes (`src/strudel/session.ts`, `src/ui/agent.ts`):
  a human-owned read/review/live dial. Read denies every mutation
  (`MODE_DENIED`); review routes agent edits into a proposal instead of the
  document; live applies directly. The dial is human-side UI state — the
  agent can only read it.
- Proposals with diff and audition: in review mode an edit returns a
  `ProposalResult` with a bounded unified diff (`src/strudel/diff.ts`,
  written for this repo); the page shows a proposal bar (summary, line span,
  diff, Audition/Accept/Discard) and the agent may audition the proposal
  itself (`strudel_evaluate({proposalId})`). Accepting is stale-guarded
  against the base `codeHash`.
- Solo: `strudel_evaluate({range})` plays just the selected slice of the
  visible source (space-padded so Strudel's own highlighting still lands on
  the right characters), with a Solo chip in the page until the next full
  Update. The page's own "Run selection" button and Ctrl+Shift+Enter do the
  same for the human.
- Recording with analysis (`src/strudel/audio-tap.ts`,
  `src/strudel/analysis.ts`): a master-output tap installed by mirroring
  connections to `AudioDestinationNode` (no change to Strudel's graph or
  gain), `MediaRecorder` capture, and PCM analysis of the decoded clip —
  peak/RMS dBFS, a 250 ms loudness curve, low/mid/high band estimates,
  silence detection. `strudel_record` works per-voice (`.analyze("id")`
  sources) and until-stopped (the human presses Stop); every take is left
  in the page's Takes shelf as a playable/downloadable clip with a waveform.
  The human's Rec button records the same way, and either side can stop the
  other's take.
- Sound awareness: `strudel_list_sounds` reads the live registry Strudel's
  scheduler actually resolves `s("...")` against; `strudel_load_samples`
  loads through Strudel's own `samples()` (https/github:strudel.json/data
  URLs), and the human can drag-drop audio files in — both appear in the
  Samples shelf.
- Versions: `strudel_snapshot` saves the visible source as a named version
  (restore in-page, export `.strudel`, open at strudel.cc via the same
  URL-hash format the app itself accepts).
- Themes: `strudel_set_theme` switches the editor through the REPL's own
  settings path.
- "Sounding" context: while playing, `strudel_get_context` reports the
  source ranges audible at that instant, derived from Strudel's own active
  hap tracking — no second scheduler or pattern interpreter.
- Session state (`src/strudel/session.ts`): an observable store for the
  mode/proposal/solo/recording/snapshots/samples state behind the UI. It
  never wakes the agent (section 42) — it only renders human-side UI.
- E2E coverage for all of the above: `tests/e2e/agent-modes.spec.ts`
  exercises the mode denials, the full proposal lifecycle, solo, combined
  edit+evaluate, both recording modes, per-voice and bad sources, sample
  loading, snapshots, and themes against the real REPL.
