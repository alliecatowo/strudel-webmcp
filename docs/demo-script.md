# Demo script

Target length: 90–120 seconds. Audio is the wow factor — keep narration
brief and let the music carry it.

## Pre-flight checklist

- [ ] Browser with WebMCP available (Chrome 149+ / Edge 150+ origin trial, or
      ChatGPT Desktop) and a compatible browser agent connected.
- [ ] System audio on, volume checked before recording.
- [ ] Page loaded fresh at the live URL; `WebMCP ready · 8 tools` visible in
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

## Final line

Close on:

> "The agent isn't controlling another Strudel session. It's playing in the
> one I'm already performing in."
>
> "No MCP server, WebSocket bridge, or session ID — the page itself is the
> integration."
