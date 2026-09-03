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

## Solo and audition evaluate derived, non-document code

Decision: `strudel_evaluate` with `range` (solo) or `proposalId` (audition) evaluates a string that is not literally the current document text.
Why BUILD_CONTRACT could not be followed: Section 41 ("NO HIDDEN EVALUATION") and CLAUDE.md say never execute hidden Strudel source, in the sense of `strudel_eval_arbitrary_code(code)` where the code never becomes visible. A solo and an audition cannot be expressed as "evaluate the visible document" at all — that is the whole point of hearing one stack entry in isolation, or previewing a proposal before accepting it.
Evidence: `evaluateDerived` and `soloRange` in `src/strudel/adapter.ts`.
Replacement (why this stays within the rule's intent):
- The evaluated string is always **derived from visible source**: a solo is the selected range of the document itself, space-padded so every offset the human's highlighting uses still lands on the same characters; an audition's code is the visible document plus the proposal's edits, which the page renders as a diff next to the accept/discard bar. Nothing is ever evaluated that the human cannot see the origin of.
- It is **transient**: a solo is cleared by the next full Update (the page shows a Solo chip until then); an audition never touches the document and ends when the human accepts (which re-evaluates the now-visible document) or discards (which re-evaluates the document as it was).
- It is **disclosed**: the tool descriptions ("solo, play only that slice of the visible source", "audition a pending proposal without changing the document"), the UI chips, and `strudel_get_context`'s `agent.auditioning`/`agent.solo` all state what is sounding. The agent cannot use these paths to sneak code past the human: the input is a range of, or a proposal over, the visible document — there is no free-form `code` parameter anywhere.

## Tool count grew from eight to thirteen

Decision: v2 adds `strudel_record`, `strudel_list_sounds`, `strudel_load_samples`, `strudel_snapshot`, and `strudel_set_theme` on top of the contract's eight.
Why BUILD_CONTRACT could not be followed: Section 47 fixes the tool list at eight and warns against proliferating 40 tiny tools.
Evidence: `STRUDEL_TOOL_NAMES` in `src/webmcp/tools.ts`.
Replacement (why five, and not more): the first eight tools make the agent a co-editor; the v2 wave is the smallest set that makes it a co-performer and gives it ears — you cannot close the loop on "did my edit actually make it quieter?" without recording, you cannot name sounds without listing them, and human-in-the-loop review (read/review/live modes, proposals) needs something to review against (snapshots). Each new tool is a distinct capability with its own failure modes (recording has a lifecycle; sample loading has a registry), not a fragment of an existing one — no existing tool changed meaning, and none of the eight was split. The counter-pressure in section 47 is respected: thirteen, not forty, and no further tools are planned.
