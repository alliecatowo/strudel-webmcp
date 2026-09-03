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
- It is **transient**: a solo is cleared by the next full Update (the page shows a solo notice until then); an audition never touches the document and ends when the human accepts (which re-evaluates the now-visible document) or discards (which re-evaluates the document as it was).
- It is **disclosed**: the tool descriptions ("solo, play only that slice of the visible source", "audition a pending proposal without changing the document"), the page notice, and `strudel_get_context`'s `agent.auditioning`/`agent.solo` all state what is sounding. The agent cannot use these paths to sneak code past the human: the input is a range of, or a proposal over, the visible document — there is no free-form `code` parameter anywhere.

## UI/UX reconciliation: no agent-only UI, reuse native, restrain the rest

Decision: Every custom surface was audited against what the pinned
`<strudel-editor>` actually exposes, and reconciled per the standing rule —
the page is for humans, the agent extends it; nothing exists only for agents.
Evidence: `node_modules/@strudel/repl/repl-component.mjs` (the whole element
is ~2 KB: it mounts a `StrudelMirror` in a sibling `<div>`, forwards settings
via `updateSettings`, and emits `update` events — no transport buttons, no
panels, no sample browser, no theme picker, no slots) and
`docs/research/strudel-repl.md`.

| Custom element | Native alternative? | Verdict | Rationale |
|---|---|---|---|
| Play / Update buttons | None — the component ships no transport UI, only Ctrl+Enter / Ctrl+. shortcuts | KEEP, genuinely-human | A human cannot "press Play" (contract §12/54) without them. They call the element's own `toggle()` / `evaluate()`; no parallel scheduler. |
| Run-selection button | None | KEEP, genuinely-human | "Hear just this" is normal live-coding. Same `soloRange` path the `strudel_evaluate({range})` tool uses; enabled only with a non-empty selection. |
| Record button + Takes list | None | KEEP, genuinely-human | One record control, one takes list (playback, download, waveform). Takes carry no origin: `Clip`, `RecordingState` and `strudel_get_context`'s `recording` have no `by` field — a take is a take, whoever triggered it. |
| Samples shelf (chips) + Import audio + drag-drop | None in the component (strudel.cc's full IDE has import UI; the embeddable component does not) | KEEP, minimal human surface | Shows what `s("…")` resolves against in this session; humans add files by drag-drop or Import audio, the agent via `strudel_load_samples` — same registry, no per-origin labeling (`LoadedSample.source` removed). |
| Versions shelf + Save version / Export | None | KEEP, genuinely-human | Normal "versions" affordance: restore, export `.strudel`, open at strudel.cc. `strudel_snapshot` adds to the same list. |
| Proposal bar (review mode) | None | KEEP, restyled native | Reads like a code-review suggestion, not agent chrome: "Proposed change" kicker, summary, line span, diff, Show / Audition / Accept / Discard as plain buttons; keyboard-accessible; diff colored from the REPL's own danger/ok tokens. No agent branding in copy. |
| Solo/audition notice | None | KEEP, replaces two chips | One quiet line stating what is sounding ("Soloing line N — the rest is muted" / "Auditioning the proposed change") with a return action. The human must know when something other than the whole document sounds. |
| Mode dial (read/review/live) | None | KEEP, single restrained control | Owner-side publisher lockdown, not client permissioning (allow-once/always stays the client's job). One segmented control in the header; the mode is also what `strudel_get_context` reports as `agent.mode`. |
| WebMCP status strip | n/a | KEEP, restrained | Footer text reporting `document.modelContext` availability and last tool activity. Never blocks or brands the page; without WebMCP the page is still a full REPL. |
| Eval-error strip | The REPL keeps errors in `repl.state.evalError` with no visible surface | KEEP, mirrors native state | Shows the same failure the agent receives via `EVALUATION_ERROR`, nothing more. |
| `src/ui/icons.ts` (CSS-icon set) | n/a | REMOVED | Replaced by four inline SVGs at the use sites; one less module, no visual change in intent. |

Copy/storage rules applied throughout: no "agent-recorded"/"added by the agent" framing
anywhere in UI copy, element ids/classes, or session/tool types (the one deliberate
exception is the tool contract's own `agent.*` namespace in `strudel_get_context` and
`ProposalResult.awaiting: "human"` — that is agent-facing documentation of the review
handshake, not page UI). No permissioning UX beyond the mode dial. All custom CSS
derives from the REPL's own theme tokens (`--background/--foreground/--caret/--selection/
--lineHighlight/--gutterForeground` + `html.dark`), so `strudel_set_theme` re-skins the
whole page through the site's real theme system.

## Tool count grew from eight to thirteen

Decision: v2 adds `strudel_record`, `strudel_list_sounds`, `strudel_load_samples`, `strudel_snapshot`, and `strudel_set_theme` on top of the contract's eight.
Why BUILD_CONTRACT could not be followed: Section 47 fixes the tool list at eight and warns against proliferating 40 tiny tools.
Evidence: `STRUDEL_TOOL_NAMES` in `src/webmcp/tools.ts`.
Replacement (why five, and not more): the first eight tools make the agent a co-editor; the v2 wave is the smallest set that makes it a co-performer and gives it ears — you cannot close the loop on "did my edit actually make it quieter?" without recording, you cannot name sounds without listing them, and human-in-the-loop review (read/review/live modes, proposals) needs something to review against (snapshots). Each new tool is a distinct capability with its own failure modes (recording has a lifecycle; sample loading has a registry), not a fragment of an existing one — no existing tool changed meaning, and none of the eight was split. The counter-pressure in section 47 is respected: thirteen, not forty, and no further tools are planned.
