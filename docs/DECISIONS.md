# Decisions

Only actual deviations from `docs/BUILD_CONTRACT.md` are recorded here.

## Scout phase run by the lead instead of Haiku workers

Decision: The two Haiku scouts (contract sections 15–16) were not used.
Why BUILD_CONTRACT could not be followed: Both Haiku workers terminated immediately with an API rate-limit error (HTTP 429) at the start of the build.
Evidence: Agent failure notifications for both scouts; no memo was produced by either.
Replacement: The lead performed the same narrow, read-only reconnaissance against the pinned `node_modules/@strudel/repl/dist` bundle and the `webmachinelearning/webmcp` spec, and wrote `docs/research/strudel-repl.md` and `docs/research/webmcp.md` in the required form.

## Extra error code `INVALID_INPUT`

Decision: Add `INVALID_INPUT` to the error model in section 43.
Why BUILD_CONTRACT could not be followed: Section 43 has no code for malformed tool arguments that are not ranges (missing `expectedCodeHash`, non-array `edits`, non-string `code`). Reporting those as `INVALID_RANGE` or `INTERNAL_ERROR` would mislead the agent.
Evidence: `src/strudel/adapter.ts` `assertFresh`, `src/strudel/editor.ts` `planEdits`/`validateReplacement`.
Replacement: `INVALID_INPUT` with a message naming the offending argument. All other codes are exactly as listed.

## Host page supplies Play / Update buttons

Decision: The page header includes ▶ Play/■ Stop and ↻ Update buttons.
Why BUILD_CONTRACT could not be followed: Section 10 says to maximize the component's viewport "if the embedded component already supplies all necessary surrounding controls". The pinned `<strudel-editor>` ships only the editor and keyboard shortcuts (Ctrl+Enter / Ctrl+.), no transport UI, and section 12/54 require a human to "press Play".
Evidence: `docs/research/strudel-repl.md` (element class, ~L38395 of the dist bundle).
Replacement: Two buttons that call the element's own `editor.toggle()` / `editor.evaluate()`; no parallel scheduler or evaluation path. A small strip mirrors the REPL's own `error` state so the human sees the same evaluation failure the agent receives (section 44).

## `audioReady` omitted from `strudel_get_context`

Decision: Not a deviation; recorded for clarity. Section 24 allows omitting `audioReady` when it cannot be reliably known. The pinned bundle does not expose its AudioContext, so the context reports `playing` and `dirty` instead, and `AUDIO_GESTURE_REQUIRED` is derived from `navigator.userActivation`.
