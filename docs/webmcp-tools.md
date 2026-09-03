# WebMCP tools

Thirteen tools, registered once via `document.modelContext.registerTool`
(`src/webmcp/register.ts`, `src/webmcp/tools.ts`). All operate on the single
live CodeMirror document inside `<strudel-editor>` — there is no separate
agent-side copy of the source.

## Agent modes

The human chooses the agent mode in the page header, and every mutating tool
respects it (`strudel_get_context` reports the current mode as
`agent.mode`):

| Mode | What the agent may do |
|---|---|
| `read` | Read, record, snapshot, and point at code. Edits, evaluation, playback changes, sample loading and theme changes return `MODE_DENIED`. |
| `review` | Reads plus performance actions; every edit (from `strudel_apply_edits`/`strudel_replace_code`) becomes a **proposal** the human auditions, accepts or discards. |
| `live` | Everything: edits apply directly to the visible editor. `propose: true` still routes a single edit to review. |

## Positions

Every range in every tool input/output uses zero-based line/column positions,
with `end` exclusive:

```json
{
  "start": { "line": 0, "column": 0 },
  "end": { "line": 0, "column": 10 }
}
```

Where useful, results also include zero-based character offsets into the
document:

```json
{ "fromOffset": 14, "toOffset": 27 }
```

Columns count UTF-16 code units, matching CodeMirror's own offsets.

## Errors

Errors are always **returned** as a JSON object, never thrown — a rejected
`execute()` promise would reach the agent as an opaque failure with no
payload, so every tool body is wrapped (`guarded()` in
`src/webmcp/results.ts`) to catch and normalize failures instead.

```json
{
  "error": "STALE_CODE",
  "message": "The Strudel source changed since it was read. Re-read the code and retry.",
  "expectedCodeHash": "a1b2c3d4e5f6a7b8-142",
  "currentCodeHash": "1122334455667788-150"
}
```

| Code | Meaning |
|---|---|
| `WEBMCP_UNAVAILABLE` | `document.modelContext` is not present in this browser (defined for completeness; tools can't be reached if this is true, since nothing gets registered). |
| `REPL_NOT_READY` | `<strudel-editor>`'s `host.editor` (the `StrudelMirror`) hasn't been created yet. |
| `EDITOR_NOT_READY` | The `StrudelMirror` exists but its CodeMirror `EditorView`/`state` hasn't initialized yet. |
| `STALE_CODE` | `expectedCodeHash` no longer matches the live document — a human edit (typing or an inline slider move) happened since the caller last read it. Includes `expectedCodeHash` and `currentCodeHash`. |
| `INVALID_RANGE` | A position/range is out of bounds or malformed (line beyond the last line, column beyond the line length, `end` before `start`, non-integer values). |
| `INVALID_INPUT` | Structurally invalid input not covered by `INVALID_RANGE` — e.g. a missing/empty `expectedCodeHash`, an empty `edits` array, or a non-string `code`. |
| `OVERLAPPING_EDITS` | Two or more edits in one `strudel_apply_edits` call overlap or share the same zero-width insertion point. Includes the two offending ranges. |
| `SOURCE_TOO_LARGE` | A mutation would insert more than `LIMITS.maxMutation` (100,000) characters. Includes `limit`. |
| `EVALUATION_ERROR` | Strudel's evaluation of the visible source failed (transpile or runtime error). Includes a bounded `message` and, when available, `line`/`column`. |
| `AUDIO_GESTURE_REQUIRED` | Playback is stopped and the browser hasn't seen a user gesture yet; browser autoplay policy is never bypassed. |
| `PLAYBACK_ERROR` | The native play or stop path threw for a reason other than an evaluation error. Also returned when a recording is already in progress. |
| `MODE_DENIED` | The human's mode dial (read/review/live) forbids this action. Includes `mode`. |
| `NO_PROPOSAL` | A proposal was required (audition, or a stale `proposalId`) but none is pending. Includes `currentProposalId` when a different one is. |
| `NOT_PLAYING` | Recording was requested while nothing is playing. Start playback first. |
| `RECORDING_UNSUPPORTED` | This page/browser cannot record (no master tap installed, or no `MediaRecorder` codec). |
| `ABORTED` | The WebMCP call's `AbortSignal` fired before the operation completed. |
| `INTERNAL_ERROR` | Anything else, with a bounded message and no stack trace. |

## Recommended agent workflow

1. **`strudel_get_context`** — see what's currently playing, where the
   cursor/selection is, what is sounding, which mode the human chose, and get
   a fresh `codeHash`.
2. **`strudel_get_code`** — read the exact source (or the relevant line
   range) to work from.
3. **`strudel_apply_edits`** (or `strudel_replace_code`) — make the change,
   passing the `codeHash` just read. If it comes back `STALE_CODE`, go back
   to step 1 — the human changed something (typing or a slider) in the
   meantime, and their version wins. In review mode the result is a
   proposal: audition it with `strudel_evaluate({proposalId})` and wait for
   the human to accept or discard.
4. **`strudel_evaluate`** — make the edited source audible, passing the new
   `codeHash` the edit call returned (or pass `evaluate: true` with the edit
   in live mode to do both at once).
5. **`strudel_record`** — listen back: verify the change is audible
   (dBFS levels, bands) or capture a take for the human.
6. **`strudel_focus_range`** — optionally point back at exactly what was
   changed when the human asks "what did you change?" or "which bit is
   that?".

---

## `strudel_get_context`

Read the live state of the Strudel REPL the human is performing with:
playback (playing, dirty), the editor cursor, selection (with selected
text), length and codeHash, plus the agent-facing session state.

**Mutation classification:** read-only.

**Input:** none.

```json
{}
```

**Output** (`StrudelContext`):

```json
{
  "playback": {
    "playing": true,
    "dirty": false
  },
  "sounding": [
    {
      "start": { "line": 10, "column": 5 },
      "end": { "line": 10, "column": 22 },
      "fromOffset": 128,
      "toOffset": 145,
      "text": "s(\"hh*8\").bank("
    }
  ],
  "editor": {
    "codeHash": "a1b2c3d4e5f6a7b8-142",
    "length": 142,
    "lineCount": 9,
    "cursor": { "line": 8, "column": 17, "offset": 128 },
    "selection": {
      "empty": false,
      "start": { "line": 8, "column": 4 },
      "end": { "line": 8, "column": 29 },
      "fromOffset": 108,
      "toOffset": 133,
      "text": "s(\"hh*8\").gain(0.5)",
      "textTruncated": false
    }
  },
  "agent": {
    "mode": "live",
    "auditioning": false
  },
  "theme": "strudelTheme"
}
```

`playback.lastEvaluationError` is included only if the most recent evaluation
failed. `dirty` is true when the visible source differs from the code that
was last evaluated (i.e. an edit hasn't been made audible yet).

`sounding` is present only while playing and while the evaluated code matches
the visible source (or a solo is active): the source ranges whose events are
audible at this instant, from Strudel's own active-hap tracking. At most
`LIMITS.maxSounding` (32) ranges, each with at most
`LIMITS.maxSoundingText` (120) characters of text.

`agent` reports the human's permission dial and everything pending on it:
`mode` (`read`/`review`/`live`); `proposal` (`id`, `summary`, `baseCodeHash`,
`lineRange`, `stale`) when an edit is awaiting the human; `auditioning` true
while a proposal's code (not the document) is what is sounding; `solo` while
a range is soloed; `recording` (`by`, `label`, `elapsedMs`) while a clip is
being captured. `theme` is the current editor theme name, when known.

**Stale-state behaviour:** none — always reflects the current document; this
call is how an agent obtains a fresh `codeHash` in the first place.

**Errors:** `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** selected text is capped at `LIMITS.maxSelectionText` (20,000
characters); `selection.textTruncated` is `true` if it was cut.

**Annotations:** `readOnlyHint: true`, `untrustedContentHint: true` (the
source is human-authored content, not trusted instructions).

---

## `strudel_get_code`

Return the exact, current, unsaved Strudel source from the visible editor
(optionally a zero-based inclusive line range) plus its `codeHash`. Inline
`slider(...)` values appear as their current numeric literals.

**Mutation classification:** read-only.

**Input** (`startLine`/`endLine` both optional; omit both for the full
source):

```json
{ "startLine": 0, "endLine": 5 }
```

**Output** (`CodeSlice`):

```json
{
  "code": "setcps(0.52)\n\nstack(\n  // kick\n  s(\"bd*4\").bank(\"RolandTR909\").gain(1.1),",
  "codeHash": "a1b2c3d4e5f6a7b8-142",
  "lineCount": 9,
  "startLine": 0,
  "endLine": 4,
  "truncated": false
}
```

**Stale-state behaviour:** none — this is itself the read that establishes a
fresh `codeHash`.

**Errors:** `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INVALID_RANGE` (e.g.
`endLine` before `startLine`, or a non-negative-integer violation),
`INTERNAL_ERROR`.

**Bounds:** the returned slice is capped at `LIMITS.maxSourceRead` (100,000
characters); `truncated` is `true` if it was cut. Use `startLine`/`endLine` to
page through larger sources.

**Annotations:** `readOnlyHint: true`, `untrustedContentHint: true`.

---

## `strudel_apply_edits`

Atomically replace one or more non-overlapping ranges of the visible Strudel
editor in a single CodeMirror transaction. In live mode the edit lands
immediately and is not evaluated unless `evaluate: true` is passed; in review
mode (or with `propose: true`) it becomes a proposal for the human instead.

**Mutation classification:** visible-source mutation (or a proposal, which
changes nothing until the human accepts).

**Input:**

```json
{
  "expectedCodeHash": "a1b2c3d4e5f6a7b8-142",
  "edits": [
    {
      "range": { "start": { "line": 7, "column": 0 }, "end": { "line": 7, "column": 34 } },
      "text": "  note(\"<c4 eb4 g4>/2\").s(\"triangle\")"
    }
  ],
  "summary": "Softer lead",
  "propose": false,
  "evaluate": false
}
```

`summary` (≤ 140 chars) is the one-line description the human sees on a
proposal. `propose: true` forces review even in live mode. `evaluate: true`
also evaluates right after applying (live mode only; ignored for proposals).

**Output** — `EditResult` in live mode:

```json
{
  "updated": true,
  "codeHash": "1122334455667788-150",
  "changes": 1,
  "length": 150,
  "lineCount": 9,
  "evaluation": { "ok": true, "playing": true, "codeHash": "1122334455667788-150", "scope": "document" }
}
```

(`evaluation` present only when `evaluate: true` was passed.)

or `ProposalResult` in review mode / with `propose: true`:

```json
{
  "proposed": true,
  "proposalId": "proposal-mx2on-1a2b",
  "summary": "Softer lead",
  "baseCodeHash": "a1b2c3d4e5f6a7b8-142",
  "changes": 1,
  "lineRange": { "start": 7, "end": 7 },
  "diff": "@@ line 8 @@\n-  note(\"<c4 eb4 g4 bb4>/2\")…\n+  note(\"<c4 eb4 g4>/2\")…",
  "awaiting": "human"
}
```

The proposal leaves the document untouched. The human auditions, accepts or
discards it in the page; the agent may audition it itself with
`strudel_evaluate({proposalId})`. Accepting is rejected with `STALE_CODE`
if the document changed in the meantime.

**Stale-state behaviour:** rejected with `STALE_CODE` if the live document's
hash no longer matches `expectedCodeHash` — nothing is applied. All-or-nothing
across the whole batch: if any edit is invalid or overlaps another, none of
them are applied.

**Errors:** `MODE_DENIED` (read mode), `STALE_CODE`, `INVALID_INPUT`
(missing hash, empty `edits`, edit missing `text`/`range`), `INVALID_RANGE`
(out-of-bounds position), `OVERLAPPING_EDITS`, `SOURCE_TOO_LARGE`,
`AUDIO_GESTURE_REQUIRED` (only with `evaluate: true` while stopped and no
user gesture yet), `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** total inserted characters across all edits capped at
`LIMITS.maxMutation` (100,000); the returned diff is capped at
`LIMITS.maxDiffChars` (8,000 characters).

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_replace_code`

Replace the entire visible Strudel source (e.g. "start over with a minimal
techno groove"). Same mode/proposal/`evaluate` behaviour as
`strudel_apply_edits`, over the whole document.

**Mutation classification:** visible-source mutation (or a proposal).

**Input:**

```json
{
  "expectedCodeHash": "a1b2c3d4e5f6a7b8-142",
  "code": "setcps(0.5)\nstack(\n  s(\"bd*4\"),\n  s(\"~ sd\")\n)\n"
}
```

**Output** (`EditResult`, or `ProposalResult` in review mode / with
`propose: true` — same shapes as `strudel_apply_edits`):

```json
{
  "updated": true,
  "codeHash": "9988776655443322-45",
  "changes": 1,
  "length": 45,
  "lineCount": 5
}
```

**Stale-state behaviour:** rejected with `STALE_CODE` if the live document's
hash no longer matches `expectedCodeHash`.

**Errors:** `MODE_DENIED` (read mode), `STALE_CODE`, `INVALID_INPUT`
(missing hash or non-string `code`), `SOURCE_TOO_LARGE`,
`AUDIO_GESTURE_REQUIRED` (with `evaluate: true` while stopped),
`REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** `code` capped at `LIMITS.maxMutation` (100,000 characters).

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_evaluate`

Evaluate the CURRENT visible editor source with Strudel's native Update
action — exactly like the human pressing Ctrl+Enter. If music is already
playing, the pattern is swapped on the running clock without stopping it.
With `range`, solo just that slice of the visible source (e.g. one stack
entry) to hear it in isolation; with `proposalId`, audition a pending
proposal without changing the document.

**Mutation classification:** live-performance mutation.

**Input** (`range`/`proposalId` both optional; at most one of them):

```json
{ "expectedCodeHash": "1122334455667788-150" }
```

**Output** (`EvaluationResult`):

```json
{ "ok": true, "playing": true, "codeHash": "1122334455667788-150", "scope": "document" }
```

`scope` says what is sounding after the call: `document` (the whole visible
source), `solo` (only `range`; the result then also carries the exact `solo`
range, and the page shows a Solo chip until the next full evaluate), or
`audition` (the proposal's code, not the document).

**Stale-state behaviour:** rejected with `STALE_CODE` if the live document's
hash no longer matches `expectedCodeHash` before evaluation runs. Auditioning
is additionally rejected with `STALE_CODE` if the document changed after the
proposal was made.

**Errors:** `MODE_DENIED` (read mode), `STALE_CODE`, `INVALID_INPUT`
(missing hash), `NO_PROPOSAL` (unknown/expired `proposalId`),
`INVALID_RANGE` (empty solo range), `EVALUATION_ERROR` (bounded diagnostic,
with `line`/`column` when Strudel's transpiler supplies a location),
`AUDIO_GESTURE_REQUIRED` (only if playback is currently stopped — evaluating
while already playing never needs a gesture), `ABORTED`, `REPL_NOT_READY`,
`EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** `EVALUATION_ERROR` messages capped at `LIMITS.maxDiagnostic` (500
characters).

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

> Solo and audition evaluate a string **derived from** the visible source (the
> selected range, space-padded to keep its offsets, or the proposal's code —
> which is itself the visible document plus the proposed edits). Nothing is
> ever evaluated that the human cannot see; see docs/DECISIONS.md.

---

## `strudel_play`

Start the Strudel scheduler using the native play path (evaluates the
visible source if stopped; no-ops to a fresh status read if already
playing).

**Mutation classification:** live-performance mutation.

**Input:**

```json
{ "expectedCodeHash": "1122334455667788-150" }
```

**Output** (`PlaybackResult`):

```json
{ "playing": true, "codeHash": "1122334455667788-150" }
```

**Stale-state behaviour:** rejected with `STALE_CODE` if the live document's
hash no longer matches `expectedCodeHash`.

**Errors:** `MODE_DENIED` (read mode), `STALE_CODE`, `INVALID_INPUT`
(missing hash), `AUDIO_GESTURE_REQUIRED` (browser has not yet seen a user
gesture — the human must press Play once from the UI), `EVALUATION_ERROR`
(the source that would start playing fails to evaluate), `PLAYBACK_ERROR`,
`ABORTED`, `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** none beyond the shared evaluation diagnostic bound.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_stop`

Stop the Strudel scheduler (native stop/hush). The source is left untouched.

**Mutation classification:** live-performance mutation.

**Input:** none.

```json
{}
```

**Output** (`PlaybackResult`):

```json
{ "playing": false, "codeHash": "1122334455667788-150" }
```

**Stale-state behaviour:** none — no `expectedCodeHash` is accepted or
required, since stopping never touches the source.

**Errors:** `MODE_DENIED` (read mode), `PLAYBACK_ERROR`, `REPL_NOT_READY`,
`EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** none.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: false` (the
call itself carries no source-derived content).

---

## `strudel_focus_range`

Select a zero-based line/column range in the visible editor, scroll it into
view and focus the editor, so the human can see exactly which code the agent
means. Source is not changed.

**Mutation classification:** view-state only.

**Input** (`expectedCodeHash` optional):

```json
{
  "expectedCodeHash": "1122334455667788-150",
  "range": { "start": { "line": 6, "column": 2 }, "end": { "line": 6, "column": 28 } }
}
```

**Output** (`FocusResult`):

```json
{
  "focused": true,
  "codeHash": "1122334455667788-150",
  "range": {
    "start": { "line": 6, "column": 2 },
    "end": { "line": 6, "column": 28 },
    "fromOffset": 96,
    "toOffset": 122
  }
}
```

**Stale-state behaviour:** if `expectedCodeHash` is supplied and no longer
matches, rejected with `STALE_CODE`; if omitted, the call always proceeds
against whatever the document currently is (useful when the agent only wants
to point at a range it just computed from a fresh read and doesn't need the
extra guard).

**Errors:** `STALE_CODE` (only if `expectedCodeHash` given and mismatched),
`INVALID_RANGE`, `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** none beyond normal range validation.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: false`.

---

## `strudel_record`

Record the live output without interrupting playback, and get ears on it:
peak and RMS in dBFS, a loudness curve per 250 ms, approximate low/mid/high
band levels, and whether the clip was silent. Every finished take is left in
the page's Takes shelf for the human (playable, downloadable). Allowed in
every mode, including read.

**Mutation classification:** none to the source; captures audio and adds a
take to the page.

**Input** (all fields optional):

```json
{ "durationMs": 4000, "source": "master", "includeAudio": false, "label": "verse check" }
```

`durationMs` (500–30,000, default 4,000) or `untilStopped: true` — keep
recording until the human presses Stop in the page (max 5 minutes; the call
resolves when they do). `source` is `"master"` (default: everything the human
hears) or the id of a voice tagged `.analyze("id")` in the code, to isolate
that one part. `includeAudio: true` returns the clip itself as base64
webm/opus (`audioBase64`) for clips up to 20 s. `label` (≤ 60 chars) is shown
next to the take.

**Output** (`RecordResult`):

```json
{
  "recorded": true,
  "clipId": "clip-mx2on-1a2b",
  "label": "verse check",
  "mimeType": "audio/webm;codecs=opus",
  "bytes": 21483,
  "durationMs": 4013,
  "sampleRate": 48000,
  "channels": 2,
  "peakDbfs": -6.2,
  "rmsDbfs": -18.4,
  "silent": false,
  "windowMs": 250,
  "loudnessDbfs": [-19.1, -18.0, -18.9, -17.6],
  "bandsDb": { "low": -22.5, "mid": -25.1, "high": -41.3 },
  "codeHash": "1122334455667788-150",
  "source": "master"
}
```

`codeHash` is the source that was visible while recording — the agent can
correlate what it heard with what the code was.

**Stale-state behaviour:** none (no `expectedCodeHash`; recording never
touches the document).

**Errors:** `NOT_PLAYING` (nothing is running), `PLAYBACK_ERROR` (another
recording is already in progress), `INVALID_INPUT` (bad `durationMs`, or an
unknown `.analyze` id — the payload lists the `available` ids),
`SOURCE_TOO_LARGE` (`includeAudio` on a clip longer than 20 s),
`RECORDING_UNSUPPORTED` (no master tap or no MediaRecorder codec), `ABORTED`
(the call's `AbortSignal` fired; the clip is discarded), `REPL_NOT_READY`,
`INTERNAL_ERROR`.

**Bounds:** duration 0.5–30 s (5 min for `untilStopped`); only clips up to
`LIMITS.maxInlineAudioMs` (20,000 ms) are returned inline as base64.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_list_sounds`

List the sound names actually available in this session — what `s("...")`
resolves against: Strudel's prebaked drum-machine banks (e.g.
`RolandTR909_bd`), Dirt-Samples, synths, soundfonts, and anything loaded via
`strudel_load_samples` or dropped in by the human.

**Mutation classification:** read-only.

**Input** (both optional):

```json
{ "query": "909", "limit": 100 }
```

**Output**:

```json
{
  "total": 1734,
  "sounds": [
    { "name": "RolandTR909_bd", "type": "samplemap", "tag": "RolandTR909", "variants": 7 }
  ],
  "truncated": true
}
```

`query` is a case-insensitive substring filter; `limit` (1–500, default 100)
caps the list.

**Stale-state behaviour:** none.

**Errors:** `INTERNAL_ERROR`. (If Strudel's sound registry has not finished
loading, an empty list is returned rather than an error.)

**Bounds:** `limit` capped at 500.

**Annotations:** `readOnlyHint: true`, `untrustedContentHint: true` (names
come from the session's registry, which the human can extend).

---

## `strudel_load_samples`

Bring new sounds into the live session through Strudel's own `samples()`
loader, so `s("name")` works immediately. Loaded names appear in
`strudel_list_sounds` and in the page's Samples shelf. Disabled in read mode.

**Mutation classification:** session/registry mutation (not a source edit).

**Input:**

```json
{ "sources": { "stab": "https://cdn.example.net/stab.wav" } }
```

`sources` is either a map of `{ name: url | [urls] }` — where a url is
`https:`, `blob:`, or a `data:audio/*` URL the agent itself holds (≤ ~3 MB) —
or a string: `"github:user/repo"` for a repository with a `strudel.json`, or
an `https` URL to a strudel.json sample map. `baseUrl` (optional) is
prepended to relative sample paths.

**Output** (`LoadSamplesResult`):

```json
{ "loaded": ["stab"], "failed": [] }
```

`failed` lists requested names that did not register (bad URL, CORS, decode
failure).

**Stale-state behaviour:** none (no `expectedCodeHash`; loading a sample
never touches the document — the human adds `s("stab")` themselves, or asks
the agent to, through the normal stale-guarded edit path).

**Errors:** `MODE_DENIED` (read mode), `INVALID_INPUT` (malformed name, URL
scheme, or empty sources), `SOURCE_TOO_LARGE` (oversized data URL),
`REPL_NOT_READY` (Strudel's registry has not loaded yet), `INTERNAL_ERROR`.

**Bounds:** data URLs capped at 4,000,000 characters.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_snapshot`

Save the current visible source as a named version in the page's Versions
shelf, where the human can restore it, export it as a `.strudel` file, or
open it in the strudel.cc REPL. Returns a strudel.cc URL that encodes this
exact code. Allowed in every mode.

**Mutation classification:** none to the source; adds a version to the page.

**Input** (optional):

```json
{ "label": "before the drop" }
```

**Output** (`SnapshotResult`):

```json
{
  "snapshotId": "snap-mx2on-1a2b",
  "label": "before the drop",
  "codeHash": "1122334455667788-150",
  "lineCount": 20,
  "strudelUrl": "https://strudel.cc/#N4Ig…",
  "createdAt": "2026-09-02T17:00:00.000Z"
}
```

**Stale-state behaviour:** none — it snapshots whatever the document
currently is; use it before large changes or when the human likes what they
hear.

**Errors:** `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** the page keeps the 20 most recent versions.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: false`.

---

## `strudel_set_theme`

Switch the editor colour theme (Strudel's built-in themes: `strudelTheme`,
`dracula`, `nord`, `tokyoNight`, `solarizedLight`, … — the error payload for
an unknown name lists them all). View-state only; the source is never
changed. For background visuals use code instead: `await initHydra()` and
hydra chains, or `.pianoroll()` / `.scope()` on a pattern. Disabled in read
mode.

**Mutation classification:** view-state only.

**Input:**

```json
{ "theme": "nord" }
```

**Output** (`ThemeResult`):

```json
{ "theme": "nord", "themes": ["strudelTheme", "dracula", "nord", "…"] }
```

**Stale-state behaviour:** none (no `expectedCodeHash`; a theme change never
touches the document or the audio).

**Errors:** `MODE_DENIED` (read mode), `INVALID_INPUT` (unknown theme —
includes `themes`, the valid list), `REPL_NOT_READY`, `EDITOR_NOT_READY`,
`INTERNAL_ERROR`.

**Bounds:** none.

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: false`.
