# Architecture

## Diagram

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

`<strudel-editor>` is the official web component from `@strudel/repl`, mounted
top-level in `index.html`/`src/main.ts` — no iframe, no fork. There is exactly
one document: the CodeMirror instance the component owns. Everything else in
this diagram reads or mutates that document; nothing keeps a second copy of
it.

## The adapter interface

`StrudelAdapter` (`src/strudel/types.ts`) is the single seam between WebMCP
tool code and the live REPL. WebMCP tool bodies (`src/webmcp/tools.ts`) call
only these methods; no CodeMirror or `@strudel/repl` internals are referenced
outside `src/strudel/`.

```ts
export interface StrudelAdapter {
  getCode(): string;
  getCodeSlice(startLine?: number, endLine?: number): CodeSlice;
  getContext(): StrudelContext;
  applyEdits(edits: SourceEdit[], expectedCodeHash: string, options?: EditOptions): Promise<EditResult | ProposalResult>;
  replaceCode(code: string, expectedCodeHash: string, options?: EditOptions): Promise<EditResult | ProposalResult>;
  evaluate(expectedCodeHash: string, options?: EvaluateOptions, signal?: AbortSignal): Promise<EvaluationResult>;
  play(expectedCodeHash: string, signal?: AbortSignal): Promise<PlaybackResult>;
  stop(): Promise<PlaybackResult>;
  focusRange(range: SourceRange, expectedCodeHash?: string): FocusResult;
  record(options: RecordOptions, signal?: AbortSignal): Promise<RecordResult>;
  loadSamples(sources: unknown, baseUrl?: string): Promise<LoadSamplesResult>;
  listSounds(query?: string, limit?: number): { total: number; sounds: { name: string; type: string; tag?: string; variants?: number }[]; truncated: boolean };
  snapshot(label?: string): SnapshotResult;
  setTheme(theme: string): ThemeResult;

  // Human-side operations (page UI). Never exposed as tools.
  acceptProposal(): Promise<EditResult>;
  discardProposal(): void;
  auditionProposal(): Promise<EvaluationResult>;
  returnFromAudition(): Promise<EvaluationResult>;
  soloRange(range: SourceRange): Promise<EvaluationResult>;
  restoreSnapshot(id: string): EditResult;
}
```

`createStrudelAdapter(host)` in `src/strudel/adapter.ts` implements this
against the mounted `<strudel-editor>` element (`host`). Every method call
re-reads `host.editor.editor.state.doc.toString()` fresh — nothing is cached
between calls, and nothing is cached between tool invocations either.

## Data flow

**Human edit (typing).** The human types in the CodeMirror view directly.
CodeMirror's own transaction updates `state.doc`. Nothing in this project is
in that path. The next adapter call that reads the document (from any tool)
simply sees the new text and computes a new `codeHash` for it.

**Human slider move.** Strudel's built-in `SliderWidget` renders an
`<input type="range">` inline in the editor. On `input`, the widget itself
dispatches a CodeMirror change that rewrites the numeric literal in the
source — the same kind of transaction typing produces. From the adapter's
point of view this is
indistinguishable from a human typing a new number: the document changed, so
`hashCode()` of the document changes. There is no separate slider bridge or
slider-specific WebMCP tool; the source already carries the value.

**Agent edit.** `strudel_apply_edits` / `strudel_replace_code` call
`adapter.applyEdits` / `adapter.replaceCode`, which re-read the current
document, verify `expectedCodeHash` still matches it (see Stale-write rule
below), convert the given line/column ranges to CM6 offsets, and dispatch one
CodeMirror transaction (`view.dispatch({ changes })`). This is the same kind
of transaction a human edit or a slider produces — same undo history, same
visual update, same document. Which of the two happens depends on the
human's mode dial (`Session`, `src/strudel/session.ts`): in live mode the
transaction is dispatched (and optionally followed by an evaluation when
`evaluate: true`); in review mode — or with `propose: true` — nothing is
dispatched and the computed changes are stored as a proposal instead. The
page renders the proposal bar (summary, line span, diff) and only
`acceptProposal()` — a human button — ever dispatches it, re-checked against
the base hash. Read mode rejects the call outright (`MODE_DENIED`). The
agent never evaluates as a side effect of editing.

**Evaluate.** `strudel_evaluate` re-reads the document, checks the hash, and
calls `host.editor.evaluate()` — the exact function Strudel's own Update
action calls. It doesn't run any string the agent passed in; it evaluates
whatever is currently visible in the editor at call time, which is only ever
reachable by having first gone through an edit that is itself visible. The
two `EvaluateOptions` variants evaluate code **derived from** visible
source, through the REPL's inner `repl.evaluate(code)`: `range` solos a
slice of the document (space-padded so all original offsets are preserved —
Strudel's own highlighting still lands on the right characters), and
 `proposalId` auditions a pending proposal's derived document. Both are
 transient and disclosed (solo/audition notice, `agent.solo` /
 `agent.auditioning` in context). A new proposal
 supersedes any pending one, and if the superseded proposal was being
 auditioned the audio returns to the visible document — sound and state can
 never disagree about what is pending. Separately, the page watches the
 REPL's own update events: whenever an evaluation lands whose code is the
 visible document — including the human pressing Ctrl+Enter on the native
 path, outside the tools entirely — any solo/audition state is cleared, so
 the notice can never get stranded by a human evaluation the adapter never
 saw.

**Play / Stop.** `strudel_play` calls the same native evaluate path
(Strudel's play button is `toggle()`, which evaluates when stopped); it does
not run a second Strudel runtime. `strudel_stop` calls `host.editor.stop()`,
the native stop/hush path.

**Record.** A `MasterTap` (`src/strudel/audio-tap.ts`) is installed before
Strudel builds its audio graph: it wraps `AudioNode.prototype.connect` so
that every connection to an `AudioDestinationNode` is also mirrored into a
per-context `GainNode`. The tap never changes Strudel's graph or gain — it
only listens. `strudel_record` records that tap (or the `AnalyserNode`
behind a `.analyze("id")` voice) with `MediaRecorder`, decodes the clip, and
analyzes the PCM (`src/strudel/analysis.ts`): peak/RMS dBFS, a 250 ms
loudness curve, low/mid/high bands. Finished clips go to the page's Takes
 shelf for the human; the human's own Rec button records the same tap, and
 either side can stop the other's take — stopping the scheduler gracefully
 ends any recording in progress and the captured clip is kept.

## Why evaluate is separate from edit

Editing the document changes what's on screen. Evaluating changes what's
audible. Keeping them as separate tools (`strudel_apply_edits` then
`strudel_evaluate`) gives:

- transparency — the human can see a pending change before it becomes sound
- user control — an agent can stage edits without forcing an evaluation
- safer agent behavior — a bad edit doesn't automatically hit the scheduler
- easier tests — edit correctness and evaluation correctness are independently testable
- the same conceptual model a human already has in Strudel: type, then press Update

## Stale-write rule

There is exactly one rule that keeps human and agent writes from clobbering
each other:

```
Agent reads source → hash A
Human types something / moves a slider
Source becomes hash B
Agent tries a mutation with expected hash A
        ↓
STALE_CODE — rejected, nothing changes
```

Every mutating adapter method that touches the document
(`applyEdits`, `replaceCode`, `evaluate`, `play`, and `focusRange` when a hash
is supplied) calls `assertFresh(expectedCodeHash, code)`
(`src/strudel/adapter.ts`), which recomputes `hashCode()` over the live
document and throws `STALE_CODE` (`src/webmcp/errors.ts`) if it doesn't match
what the caller expected. The human's newer state is never touched or
overwritten by the rejected call — human wins, unconditionally, every time.
This applies identically whether the intervening change was typing, pasting,
deleting, or an inline slider move, because all four are just CodeMirror
transactions to the adapter.

## Audio-gesture policy

Browsers require a user gesture before WebAudio can start. This project does
not try to work around that. `hasUserActivation()`
(`src/strudel/playback.ts`) reads `navigator.userActivation.hasBeenActive` as
an honest signal. If the scheduler isn't already running and the browser
hasn't seen a gesture yet, `evaluate` and `play` throw
`AUDIO_GESTURE_REQUIRED` with the message "Start playback once using the
Strudel UI (press Play), then try again." The expected flow is: the human
presses Play once, and only after that can the agent evaluate or (re)start
playback.

## Deliberately not built

This project does not include: an MCP server, a WebSocket/SSE bridge, an embedded chat UI or LLM API, a
`strudel_set_slider` tool (the agent edits source directly; sliders already
propagate through the shared document), a hidden/arbitrary-code evaluation
tool, accounts, a database, or any reimplementation of Strudel's transpiler,
scheduler, audio engine, or CodeMirror integration. The existing instrument
is the whole point.
