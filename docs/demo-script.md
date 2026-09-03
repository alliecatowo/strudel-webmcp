# Demo script

Target length: 2–3 minutes for the full nine scenes; scenes 1–6 alone still
make the 90–120 second cut if needed. Audio is the wow factor — keep
narration brief and let the music carry it.

## Pre-flight checklist

- [ ] Browser with WebMCP available (Chrome 149+ / Edge 150+ origin trial, or
      ChatGPT Desktop) and a compatible browser agent connected.
- [ ] System audio on, volume checked before recording.
- [ ] Page loaded fresh at the live URL; `WebMCP ready · 13 tools` visible in
      the header.
- [ ] Sliders are only visible in the editor **after the first evaluation**
      (Strudel renders slider widgets on `afterEval`) — so Play must be
      pressed once before scene 2 can show them.
- [ ] Confirm the seed pattern (`src/demo-pattern.ts`) is intact: kick,
      snare, hats with a gain slider, bass with a cutoff slider, texture/lead.

## Scene 1 — Normal Strudel

Open the site.

> "This is just Strudel, the browser live-coding environment. There's no AI
> SDK or agent backend."

Human manually clicks **Play**. Music starts. Show the editor's normal visual
feedback (active-line highlight / evaluation flash).

**Tool calls:** none — this scene is explicitly WebMCP-free.

## Scene 2 — Human direct manipulation

Human drags the bass `lpf` cutoff slider — make the audible change obvious.
Then drags the hat `gain` slider.

> "I'm changing the live performance normally."

Call out on screen (or in narration) that the numeric literals in the source
visibly update as the sliders move — this is the fact the rest of the demo
depends on.

**Tool calls:** none.

## Scene 3 — Agent joins current state

Ask the agent:

> "Keep the bass and kick exactly where I left them. Make the hats evolve
> over eight bars instead of staying static."

**Expected tool calls:**

1. `strudel_get_context` — reads current playback/selection/`codeHash`.
2. `strudel_get_code` — reads the full source.
3. `strudel_apply_edits` — edits only the hats line/expression, using the
   `codeHash` from step 1 or 2.
4. `strudel_evaluate` — makes it audible.

Only the hats change in the source. Music changes **without the performance
stopping** — this is the hero moment; keep the camera on both the editor
(source diff) and the fact playback never dropped out.

## Scene 4 — Human selection

Human manually selects the bass expression in the editor.

Ask:

> "Make this less busy in the second half, but don't touch anything else."

**Expected tool calls:**

1. `strudel_get_context` — the response's `editor.selection` carries the
   exact bass expression, its range, and its text; no line-number
   description needed from the human.
2. `strudel_apply_edits` — a small edit scoped to that selection.
3. `strudel_evaluate`.

Live audio changes.

## Scene 5 — Human changes agent work

After the agent's edit, human manually tweaks an inline control again (e.g.
the bass cutoff slider once more).

> "Yeah, keep that value. Make the texture respond to it better."

**Expected tool calls:**

1. `strudel_get_context` / `strudel_get_code` — agent re-reads and gets the
   **new** `codeHash` (the slider move already changed it).
2. `strudel_apply_edits` — edits the texture/lead line, preserving the
   slider's current value untouched. (If the agent had tried to reuse the
   stale hash from scene 4, it would get `STALE_CODE` here — worth
   mentioning in narration if there's time, since it's the safety property
   the whole thing rests on.)
3. `strudel_evaluate`.

This visually reinforces that both human and agent are editing the same
live state.

## Scene 6 — Agent points back

Ask:

> "Which bit is opening the hats now?"

**Expected tool calls:**

1. `strudel_focus_range` — selects the exact hats expression in the visible
   CodeMirror editor, scrolls it into view, focuses it.

Agent explains briefly in its own words. The human sees the exact
highlighted source, not a line-number citation.

## Scene 7 — The human holds the dial (modes and proposals)

Switch the header dial to **Review** (it defaults to Live; Read is the
lockdown end). Ask the agent for a bigger change:

> "Swap the kick for a different one — but let me check it first."

**Expected tool calls:**

1. `strudel_get_context` / `strudel_get_code` — reads state and source.
2. `strudel_apply_edits` — in review mode this returns
   `{proposed: true, …}` with a diff instead of touching the editor.

A proposal bar appears under the header: summary, line span, the diff, and
Audition / Accept / Discard buttons. The music has not changed and the
source has not changed.

> "This is the safety property: in review, the agent proposes, I decide."

3. Optionally `strudel_evaluate({proposalId})` — the agent auditions its own
   proposal; the page shows an "Auditioning proposal" chip while the
   proposal (not the document) is what is sounding.

Human clicks **Audition** (or relies on the agent's), listens, then
**Accept** — the edit lands in the editor and the music updates in place —
or **Discard**. Mention that Read mode denies every mutation outright
(`MODE_DENIED`) — even the agent's evaluate and stop.

## Scene 8 — The agent gets ears (recording)

While the groove plays, ask:

> "Record four seconds and tell me: is the bass too loud?"

**Expected tool calls:**

1. `strudel_record` (`{durationMs: 4000}`) — the header Rec button shows a
   live timer while it runs; the call returns peak/RMS in dBFS, a loudness
   curve, and low/mid/high band levels, plus a playable take with a
   waveform in the Takes shelf at the bottom of the page.

Agent answers with numbers, not vibes ("bass is ~6 dB above the kick"), and
the human can hit play on the take themselves. If there's time, show
`untilStopped: true`: the recording runs until the human presses Stop, and
either side can stop the other's take. Per-voice isolation
(`source: "kick"` after adding `.analyze("kick")` to a pattern) is a good
closer if the take-home message has already landed.

## Scene 9 — New sounds and safety net (samples, versions)

Ask:

> "Load a clap from the strudel catalogue you actually have, snap a version
> first, and use it."

**Expected tool calls:**

1. `strudel_snapshot` — "before" version appears in the Versions shelf
   (restore / export / open at strudel.cc).
2. `strudel_list_sounds` (`{query: "clap"}`) — the real registry, not a
   hardcoded list.
3. `strudel_apply_edits` + `strudel_evaluate` — uses one of the listed
   names.

If time is short, show the human dragging an audio file onto the page and
it appearing in the Samples shelf next to the agent-loaded ones — same
registry, same `s("...")`.

## Final line

Close on:

> "The agent isn't controlling another Strudel session. It's playing in the
> one I'm already performing in."
>
> "No MCP server, WebSocket bridge, or session ID — the page itself is the
> integration."
