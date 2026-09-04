# Audit notes

Findings from re-reading the mutation surface — `src/strudel/adapter.ts`,
`src/webmcp/tools.ts`, `src/strudel/session.ts`, and the review-mode
(propose/audition/accept) path — against this project's own safety claims:
that every mutation is stale-write guarded by `codeHash`, and that a
`review`-mode edit becomes a proposal the human must explicitly accept.
Nothing here is a claim of a completed security audit; it is a record of
what was actually checked, with the tests that prove it.

## What was checked, and found wrong

### `strudel_record`'s `codeHash` did not describe what was recorded

`docs/webmcp-tools.md` documents the contract for `strudel_record`'s
`codeHash` field explicitly: *"codeHash is the source that was visible while
recording — the agent can correlate what it heard with what the code was."*

The implementation didn't do that. In
[`adapter.ts`](../src/strudel/adapter.ts), `record()` read the document
*after* `recordMaster()` resolved:

```ts
rec = await recordMaster(tap, { maxMs: ms, until: stopper.signal, signal, sourceNode });
// ...
codeHash: hashCode(read()),   // read() here, not before recordMaster()
```

A recording can run for a long time — up to 30 s for a fixed `durationMs`,
or up to `maxUntilStoppedMs` (5 minutes) for `untilStopped: true` — and
nothing in `record()` prevents the human or the agent from editing and
re-evaluating the document while it runs (`record()` never calls
`assertAgentMay`, by design — recording is allowed in every mode, including
`read`). If the code changed mid-take, the returned `codeHash` was hashed
against whatever text happened to be on screen when the *take* ended, not
the code that produced the audio being described by the rest of the result
(`bandsDb`, `peakDbfs`, the waveform). An agent asking "is the bass in this
clip too loud, and where in the code is the bass" could be handed a
`codeHash` for a bass line that isn't the one in the recording — the exact
failure mode the field exists to prevent.

**Fix:** hash the document once, before `recordMaster()` starts, and use
that value in the result instead of re-reading afterwards. See the `codeHash`
capture in `record()` in [`adapter.ts`](../src/strudel/adapter.ts).

**Test:** `tests/e2e/agent-modes.spec.ts`, `strudel_record › codeHash
reflects the code visible when recording started, not a later edit made
mid-take`. Starts an `untilStopped` recording, applies and evaluates a real
edit (`hh*8` → `hh*16`) partway through the take, then stops it and asserts
the returned `codeHash` matches the hash from *before* the edit, not after.
Confirmed to fail against the pre-fix code (`rec.codeHash` came back equal
to the post-edit hash) and pass against the fix, run three times each way to
rule out flake.

## What was checked and found correct

### Can a `review`-mode proposal apply without the human accepting it?

No path found. `applyEdits`/`replaceCode` in `review` mode (or with
`propose: true`) only ever call `makeProposal()`, which stores the proposal
in `Session` and returns a diff — it never calls `dispatchChanges()` against
the live CodeMirror document. The only functions that do dispatch a
proposal's changes into the document are `acceptProposal()` and
`restoreSnapshot()`, and neither is registered as a WebMCP tool
(`STRUDEL_TOOL_NAMES` in `src/webmcp/tools.ts` lists 13 tools; `accept`,
`discard`, `audition`, `returnFromAudition`, and `restoreSnapshot` are wired
only to button clicks in `src/ui/agent.ts` / `src/ui/shelf.ts`, never to
`buildStrudelTools()`). `strudel_evaluate({ proposalId })` — the one
agent-reachable way to "run" a proposal — plays the proposal's derived code
through `evaluateDerived()` without writing to the document at all
(`session.setAuditioning(true)`, no `dispatchChanges`); the getContext()
`agent.proposal.stale` flag correctly turns `true` the moment the underlying
document hash no longer matches `baseCodeHash`, and `acceptProposal()`
independently re-checks that hash and throws `STALE_CODE` if it moved. This
matches the existing coverage in
`tests/e2e/agent-modes.spec.ts` ("review mode: edits become a proposal; the
document changes only when the human accepts").

### Does the `codeHash` staleness guard cover every mutating path?

`applyEdits`, `replaceCode`, `evaluate`, `play`, and `focusRange` (when given
a hash) all call `assertFresh()` before doing anything else. `record`,
`loadSamples`, `snapshot`, and `setTheme` don't take a `codeHash` at all —
correctly, since none of them write to the CodeMirror document (they touch
audio/session/theme state, not the source text), so there is nothing for a
stale hash to protect against. `restoreSnapshot` does write to the document
without a hash check, but it is human-only (see above), triggered by a
direct button click with no stale-read window to exploit. The one real gap
was the `record()` provenance bug above — not a staleness bypass exactly,
since recording never gates on a hash, but the same class of "the field
lies about which code applies" problem, now fixed.

### `.analyze("id")` recording of an unknown voice

`resolveAnalyser()` in `src/strudel/audio-tap.ts` already handles a missing
id gracefully: it throws `INVALID_INPUT` with the requested id in the
message and the list of currently-available ids in `details.available`, so
an agent that guesses wrong gets enough information to self-correct on the
next call. Covered by the existing `strudel_record › an .analyze(id) source
isolates one voice; unknown ids list what is available` test. No change
needed.

## One thing noted, not changed

`Session`'s default agent mode — when nothing is persisted in
`localStorage` yet — is `'live'`, not `'read'` (`readPersistedMode()` in
`src/strudel/session.ts`; the mode dial in `index.html` starts on the same
setting). A first-time visitor with a WebMCP-capable agent attached gets an
agent that can edit and evaluate their document immediately, before they've
touched the mode dial themselves. This is consistent everywhere (markup,
session default, and the demo GIF all agree it's intentional, not an
oversight), and changing a permission default is a product decision, not a
bug fix, so it was left alone here. Flagging it because the project's whole
safety pitch is "the human owns the dial," and the unconfigured default is
the maximally-permissive setting rather than the maximally-cautious one.

## How this was found

Code review, not a scanner: reading `adapter.ts`'s mutating methods and
`session.ts` side by side against the specific claims in
`docs/webmcp-tools.md` and the mode descriptions in `tools.ts`, then writing
a test for each claim that looked exploitable before touching any fix.

## Evidence

`tests/e2e/agent-modes.spec.ts` — new test in the `strudel_record` describe
block, run individually (3x repeat, both pre-fix and post-fix) and as part
of the full suite. Full-suite counts before and after this pass: 75/75 unit
tests (`npx vitest run`, unchanged by this work), 53 → 54 e2e tests
(`npx playwright test`), all new and pre-existing record/agent-mode tests
passing.

Two pre-existing e2e tests unrelated to this review — `apply-edits.spec.ts`
"Control+z after an agent edit restores the previous doc" and
`slider.spec.ts` "moving the hat gain slider... updates its own hash" — were
observed to fail intermittently on unmodified `main` in this same
environment (confirmed via `git stash` before making any changes here); they
are real-browser timing-sensitive tests, not something this pass introduced
or touched. Worth a look before the next deadline, but out of scope tonight.
