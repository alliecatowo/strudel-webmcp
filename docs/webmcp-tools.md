# WebMCP tools

Eight tools, registered once via `document.modelContext.registerTool`
(`src/webmcp/register.ts`, `src/webmcp/tools.ts`). All operate on the single
live CodeMirror document inside `<strudel-editor>` — there is no separate
agent-side copy of the source.

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
| `PLAYBACK_ERROR` | The native play or stop path threw for a reason other than an evaluation error. |
| `ABORTED` | The WebMCP call's `AbortSignal` fired before the operation completed. |
| `INTERNAL_ERROR` | Anything else, with a bounded message and no stack trace. |

## Recommended agent workflow

1. **`strudel_get_context`** — see what's currently playing, where the
   cursor/selection is, and get a fresh `codeHash`.
2. **`strudel_get_code`** — read the exact source (or the relevant line
   range) to work from.
3. **`strudel_apply_edits`** (or `strudel_replace_code`) — make the change,
   passing the `codeHash` just read. If it comes back `STALE_CODE`, go back
   to step 1 — the human changed something (typing or a slider) in the
   meantime, and their version wins.
4. **`strudel_evaluate`** — make the edited source audible, passing the new
   `codeHash` the edit call returned.
5. **`strudel_focus_range`** — optionally point back at exactly what was
   changed when the human asks "what did you change?" or "which bit is
   that?".

---

## `strudel_get_context`

Read the live state of the Strudel REPL the human is performing with:
playback (playing, dirty), and the editor cursor, selection (with selected
text), length and codeHash.

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
  }
}
```

`playback.lastEvaluationError` is included only if the most recent evaluation
failed. `dirty` is true when the visible source differs from the code that
was last evaluated (i.e. an edit hasn't been made audible yet).

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
editor in a single CodeMirror transaction. Does **not** evaluate — call
`strudel_evaluate` afterwards to make the change audible.

**Mutation classification:** visible-source mutation.

**Input:**

```json
{
  "expectedCodeHash": "a1b2c3d4e5f6a7b8-142",
  "edits": [
    {
      "range": { "start": { "line": 7, "column": 0 }, "end": { "line": 7, "column": 34 } },
      "text": "  note(\"<c4 eb4 g4>/2\").s(\"triangle\")"
    }
  ]
}
```

**Output** (`EditResult`):

```json
{
  "updated": true,
  "codeHash": "1122334455667788-150",
  "changes": 1,
  "length": 150,
  "lineCount": 9
}
```

**Stale-state behaviour:** rejected with `STALE_CODE` if the live document's
hash no longer matches `expectedCodeHash` — nothing is applied. All-or-nothing
across the whole batch: if any edit is invalid or overlaps another, none of
them are applied.

**Errors:** `STALE_CODE`, `INVALID_INPUT` (missing hash, empty `edits`, edit
missing `text`/`range`), `INVALID_RANGE` (out-of-bounds position),
`OVERLAPPING_EDITS`, `SOURCE_TOO_LARGE`, `REPL_NOT_READY`, `EDITOR_NOT_READY`,
`INTERNAL_ERROR`.

**Bounds:** total inserted characters across all edits capped at
`LIMITS.maxMutation` (100,000).

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_replace_code`

Replace the entire visible Strudel source (e.g. "start over with a minimal
techno groove"). Does **not** evaluate automatically.

**Mutation classification:** visible-source mutation.

**Input:**

```json
{
  "expectedCodeHash": "a1b2c3d4e5f6a7b8-142",
  "code": "setcps(0.5)\nstack(\n  s(\"bd*4\"),\n  s(\"~ sd\")\n)\n"
}
```

**Output** (`EditResult`):

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

**Errors:** `STALE_CODE`, `INVALID_INPUT` (missing hash or non-string
`code`), `SOURCE_TOO_LARGE`, `REPL_NOT_READY`, `EDITOR_NOT_READY`,
`INTERNAL_ERROR`.

**Bounds:** `code` capped at `LIMITS.maxMutation` (100,000 characters).

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

---

## `strudel_evaluate`

Evaluate the CURRENT visible editor source with Strudel's native Update
action — exactly like the human pressing Ctrl+Enter. If music is already
playing, the pattern is swapped on the running clock without stopping it.

**Mutation classification:** live-performance mutation.

**Input:**

```json
{ "expectedCodeHash": "1122334455667788-150" }
```

**Output** (`EvaluationResult`):

```json
{ "ok": true, "playing": true, "codeHash": "1122334455667788-150" }
```

**Stale-state behaviour:** rejected with `STALE_CODE` if the live document's
hash no longer matches `expectedCodeHash` before evaluation runs.

**Errors:** `STALE_CODE`, `INVALID_INPUT` (missing hash), `EVALUATION_ERROR`
(bounded diagnostic, with `line`/`column` when Strudel's transpiler supplies
a location), `AUDIO_GESTURE_REQUIRED` (only if playback is currently
stopped — evaluating while already playing never needs a gesture),
`ABORTED`, `REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

**Bounds:** `EVALUATION_ERROR` messages capped at `LIMITS.maxDiagnostic` (500
characters).

**Annotations:** `readOnlyHint: false`, `untrustedContentHint: true`.

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

**Errors:** `STALE_CODE`, `INVALID_INPUT` (missing hash),
`AUDIO_GESTURE_REQUIRED` (browser has not yet seen a user gesture — the human
must press Play once from the UI), `EVALUATION_ERROR` (the source that would
start playing fails to evaluate), `PLAYBACK_ERROR`, `ABORTED`,
`REPL_NOT_READY`, `EDITOR_NOT_READY`, `INTERNAL_ERROR`.

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

**Errors:** `PLAYBACK_ERROR`, `REPL_NOT_READY`, `EDITOR_NOT_READY`,
`INTERNAL_ERROR`.

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
