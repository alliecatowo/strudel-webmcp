# CODEX_DRIVER — external verification protocol for Strudel WebMCP

You are an EXTERNAL verifier (e.g. Codex) with a WebMCP-capable browser
(Chrome 149+ / Edge 150+ with the WebMCP origin trial, or equivalent). Verify
this app **from the flows, not the code**: drive the live page through its
WebMCP tools as a browser agent would, watch what the human sees, and report
pass/fail. You do not need to read the repository. (If you do peek at source,
treat the live behavior as authoritative and note any divergence.)

Live URL: **https://strudel-webmcp.vercel.app**

## 0. Setup

1. Open the live URL fresh (new profile or hard reload, so localStorage mode
   state is default).
2. Confirm the footer reads `WebMCP ready · 13 tools`. If it reads
   `WebMCP unavailable`, your browser cannot do this protocol — stop and
   report `SETUP_BLOCKED`.
3. Confirm the editor shows the seed groove (kick, snare, hats, bass,
   texture/lead) and the header dial reads **Live**.
4. Audio without a microphone: recording taps the master output — no mic is
   ever needed. Two autoplay realities apply:
   - Browsers require a user gesture before WebAudio starts. If playback is
     stopped and no gesture has happened, `strudel_evaluate` and
     `strudel_play` return `AUDIO_GESTURE_REQUIRED` ("press Play once").
     **Click Play in the page once yourself** — after that, tool playback
     works.
   - Headless runs: launch Chromium with
     `--autoplay-policy=no-user-gesture-required`, or synthesize one click on
     the page body before playing. The project's own CI does the former.
5. Keep a scratch note of every `codeHash` you receive — almost every
   mutation requires the fresh one (`expectedCodeHash`). A stale hash must
   fail with `STALE_CODE` and change nothing; that is the human-wins rule,
   not a bug.

Conventions below: each check gives the **exact call**, the **expected
result**, and the **expected visible UI/state change**. Mark each
PASS / FAIL / BLOCKED with the observed evidence (hashes, error codes,
button/notice text).

## 1. Per-tool checklist

### T1 `strudel_get_context` — `{}`
- Expected result: `playback.playing` boolean, `playback.dirty` boolean,
  `editor.codeHash` (string), `editor.cursor`, `editor.selection`
  (with `text`), `editor.lineCount`, `agent.mode` (`"live"` by default),
  `agent.auditioning: false`, `theme` name.
- Visible change: footer activity shows `· get_context ✓`. Nothing else
  moves. This call is always how you get a fresh `codeHash`.

### T2 `strudel_get_code` — `{}` then `{"startLine": 0, "endLine": 2}`
- Expected result: full source + `codeHash` matching T1; then a 3-line slice
  with `startLine/endLine` echoed and `truncated: false`.
- Visible change: footer shows `· get_code ✓`. Editor untouched.

### T3 `strudel_apply_edits` (live) — insert a comment line
- Call with the fresh hash: `{"expectedCodeHash": "<h>", "edits":
  [{"range": {"start": {"line": 0, "column": 0}, "end": {"line": 0, "column": 0}},
  "text": "// codex check\n"}]}`.
- Expected result: `{updated: true, codeHash: "<h2>", changes: 1}` with
  `<h2>` != `<h>`.
- Visible change: the comment appears at the top of the **visible editor**;
  footer shows `· apply_edits ✓`. Undo (Ctrl+Z) removes it — agent edits are
  ordinary editor transactions.

### T4 `strudel_evaluate` — `{"expectedCodeHash": "<h2>"}`
- Precondition: press Play in the page once first (setup step 4), so music
  is playing.
- Expected result: `{ok: true, playing: true, scope: "document"}`.
- Visible change: music keeps playing without stopping (pattern swaps on the
  running clock); footer shows `· evaluate ✓`. Re-read context: `dirty`
  is now `false`.

### T5 `strudel_play` — `{"expectedCodeHash": "<fresh>"}`
- While already playing: returns `{playing: true}` (no-op status read).
- Then `strudel_stop` — `{}`. Expected: `{playing: false}`; the header Play
  button flips back to "Play". Stop takes no hash and never touches source.

### T6 `strudel_focus_range` — point at the comment from T3
- `{"range": {"start": {"line": 0, "column": 0}, "end": {"line": 0, "column": 14}}}`.
- Expected: `{focused: true, codeHash, range}` with offsets echoed.
- Visible change: line 1 selects and scrolls into view; editor takes focus.
  Source unchanged.

### T7 `strudel_record` — `{"durationMs": 2000, "label": "codex check"}`
- Precondition: playing (press Play again if you stopped in T5).
- Expected result: `{recorded: true, clipId, label: "codex check",
  peakDbfs, rmsDbfs, loudnessDbfs[], bandsDb{low,mid,high}, silent: false,
  codeHash, source: "master"}`. Numbers finite; `silent` false for the seed
  groove.
- Visible change: the header Rec button shows a live timer while recording;
  afterwards a take labeled "codex check" with waveform + audio player sits
  in the **Takes** shelf — playable and downloadable by the human. Footer
  shows `· record ✓`.

### T8 `strudel_list_sounds` — `{"query": "bd", "limit": 5}`
- Expected: `{total >= 1, sounds[]}` with names containing "bd";
  `truncated: true` when total > limit.
- Visible change: footer shows `· list_sounds ✓` only. Registry untouched.

### T9 `strudel_load_samples` — data-URL beep
- Build a tiny WAV data URL yourself (any ≤ 100 KB `data:audio/wav;base64,…`
  clip), call `{"sources": {"codexbeep": "<data-url>"}}`.
- Expected: `{loaded: ["codexbeep"], failed: []}`.
- Visible change: a `codexbeep` chip appears in the **Samples** shelf;
  `strudel_list_sounds({"query": "codexbeep"})` now lists it. Then call with
  `{"sources": "not a url"}` → `INVALID_INPUT`.
- Cleanup: you cannot unload; note it and move on (one extra chip is
  harmless).

### T10 `strudel_snapshot` — `{"label": "codex before"}`
- Expected: `{snapshotId: "snap-…", label: "codex before",
  codeHash: <current>, strudelUrl: "https://strudel.cc/#…"}`.
- Visible change: a "codex before" card in **Versions**. Open the
  `strudelUrl` in a new tab — it loads the same code at strudel.cc.

### T11 `strudel_set_theme` — `{"theme": "nord"}`
- Expected: `{theme: "nord", themes: [...]}` with a long built-in list.
- Visible change: the whole page (editor + chrome) re-skins through the
  theme. `strudel_get_context` now reports `theme: "nord"`.
  `{"theme": "nope"}` → `INVALID_INPUT` with the valid `themes` list.
- Restore `"strudelTheme"` afterwards so later flows read normally.

### T12 read-mode denials
- Click **Read** on the header dial. Confirm `strudel_get_context` reports
  `agent.mode: "read"`.
- `strudel_apply_edits`, `strudel_replace_code`, `strudel_evaluate`,
  `strudel_stop`, `strudel_set_theme`, `strudel_load_samples` must ALL return
  `MODE_DENIED` (with `mode: "read"`) and change nothing.
- Still allowed in read mode: `strudel_get_context`, `strudel_get_code`,
  `strudel_focus_range`, `strudel_record` (while playing),
  `strudel_snapshot`, `strudel_list_sounds`. Verify at least focus + snapshot.
- Click back to **Live**.

### T13 `strudel_replace_code` + stale hash
- Read a fresh hash, then replace the whole source with a minimal groove,
  e.g. `{"expectedCodeHash": "<h>", "code": "setcps(0.5)\nstack(s(\"bd*4\"), s(\"~ sd\"))\n"}`.
  Expect `{updated: true}` and the visible editor showing exactly that code.
- Immediately retry with the OLD hash → `STALE_CODE`, document unchanged.
- Restore: replace again with the fresh hash back to a musical pattern (or
  reload the page for the seed).

## 2. Interaction flows

### F1 Stale-write human-wins (typing)
1. Read a hash via `strudel_get_code`. Keep it.
2. Type characters into the editor yourself (click editor, type `// human\n`).
3. Call `strudel_apply_edits` with the OLD hash → expect `STALE_CODE`,
   document still shows your typing, nothing applied. **PASS = human wins.**

### F2 Stale-write human-wins (inline slider)
1. Press Play (sliders render only after the first evaluation).
2. Read a hash. Drag the bass cutoff (or hats gain) slider in the editor;
   watch its numeric literal change in the source.
3. Call `strudel_apply_edits` with the pre-drag hash → `STALE_CODE`.
   Re-read: the new hash reflects the slider value. **PASS = slider moves
   count as human edits.**

### F3 Modes: review proposal lifecycle
1. Click **Review**. `strudel_get_context` reports `agent.mode: "review"`.
2. `strudel_apply_edits` (fresh hash, small change, `summary: "codex swap"`)
   → `{proposed: true, proposalId, summary: "codex swap", diff,
   awaiting: "human"}`. Document UNCHANGED; proposal bar visible with
   summary, line span, diff, and Show / Audition / Accept / Discard.
3. `strudel_evaluate({"expectedCodeHash": "<fresh>", "proposalId": "<id>"})`
   → `{ok: true, scope: "audition"}`. Notice reads "Auditioning the proposed
   change"; document still unchanged.
4. Click **Accept** in the page → edit lands in the editor, notice clears,
   music updates. Context shows no pending proposal, `auditioning: false`.
5. Repeat steps 2–3 with a different edit, then click **Discard** → bar
   hides, music returns to the document, no proposal pending.
6. Stale proposal: make a proposal, then type in the editor yourself, then
   click **Accept** → must NOT apply (stale); the bar shows a "code changed
   after this change was proposed" note until you **Discard** it.
7. Click back to **Live**.

### F4 Solo entry and every exit
1. (Live mode, playing.) `strudel_evaluate({"expectedCodeHash": "<h>",
   "range": <one stack line>})` → `{ok: true, scope: "solo"}`. Notice reads
   "Soloing line N — the rest is muted".
2. Evaluate the whole document via tool → notice clears.
3. Solo again, then press **Update** in the page → notice clears, full
   pattern sounds.
4. Solo again, then Ctrl+Enter in the editor (native path, no tool) →
   notice clears. **PASS = no exit strands the notice.**

### F5 Record → take appears; anyone can stop
1. (Playing.) Call `strudel_record` with `{"untilStopped": true,
   "label": "codex long"}` and DO NOT await yet — start it, wait ~1 s,
   confirm the Rec button shows recording.
2. Press the page **Rec button** → the call resolves, take "codex long"
   appears in Takes. **PASS = human stops agent take, clip kept.**
3. Repeat, but this time press **Play (Stop)** instead → call still
   resolves with the captured clip kept. **PASS = stop ends take
   gracefully.**

### F6 Snapshot / share round-trip
Covered in T10 — additionally, from the Versions card click **Export**
(downloads `.strudel`) and **Restore** on "codex before" (editor returns to
that code). **PASS = versions are human-usable, not agent-only.**

## 3. Pass/fail report template

```
# Strudel WebMCP external verification — <date>
Environment: <browser + version, headed/headless, URL, gesture setup used>
Mode default on load: <live?>

## Per-tool checks (T1–T13)
| Check | Call (inputs) | Expected | Observed | Verdict |
|---|---|---|---|---|
| T1 get_context | … | … | … | PASS/FAIL/BLOCKED |
…one row per check…

## Interaction flows (F1–F6)
| Flow | Steps done | Expected | Observed | Verdict |
|---|---|---|---|---|
…one row per flow…

## Shared-state philosophy audit (answer each)
1. Did every mutation land in the SAME editor/REPL the human sees? (Y/N + evidence)
2. Did any tool keep or execute a copy of the source the human can't see? (Y/N)
3. Could the human always see, exit, or override agent state (proposals, solo/audition, takes, modes)? (Y/N + which exit you used)
4. Did reads leave only the quiet footer trail (no popups, locks, or prompts)? (Y/N)
5. Any agent-only UI, origin labels ("by agent…"), or consent prompts? (must be NONE)

## Counts
Tools: <x>/13 PASS, Flows: <y>/6 PASS, Philosophy: <z>/5 clean
## Verdict
<SHIP / SHIP-WITH-NOTES / DO-NOT-SHIP> + one-paragraph justification + note numbers.
```

Rules: never "fix" the page to make a check pass (no console patching, no
injecting state — drive it like a user with tools). If the page is mid-broken
by your own earlier step, reload and note it. Report observed behavior
verbatim (error codes, hashes, notice text) — that is the evidence.
