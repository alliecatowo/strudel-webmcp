# Demo script

Target length: 2–3 minutes for the full run; steps 1–12 alone still make the
90–120 second cut if needed. Audio is the wow factor — keep narration brief
and let the music carry it. Each step says what you **DO** (hands) and what
you **SAY** (voice).

## Pre-flight

- [ ] Browser with WebMCP available (Chrome 149+ / Edge 150+ origin trial, or
      ChatGPT Desktop) and a compatible browser agent connected.
- [ ] System audio on, volume checked before recording.
- [ ] Page loaded fresh at the live URL; `WebMCP ready · 13 tools` visible in
      the header.
- [ ] Sliders are only visible in the editor **after the first evaluation**
      (Strudel renders slider widgets on `afterEval`) — so Play must be
      pressed once before step 3 can show them.
- [ ] Confirm the seed pattern (`src/demo-pattern.ts`) is intact: kick,
      snare, hats with a gain slider, bass with a cutoff slider, texture/lead.
- [ ] Header mode dial on **Live** (the default).

## Human pattern

**Step 1 — open the page.**

- DO: Open the site. Do nothing else for a beat.
- SAY: "This is just Strudel, the browser live-coding environment. No AI SDK,
  no agent backend, no session ID — opening the page is the whole setup."

**Step 2 — play the seed groove.**

- DO: Click **Play**. Music starts.
- SAY: "I press Play, and we're live. That editor is the whole instrument."

**Step 3 — move sliders like a performer.**

- DO: Drag the bass `lpf` cutoff slider until the change is obvious, then the
  hat `gain` slider. Point at the numeric literals updating in the source.
- SAY: "I'm changing the performance normally — and watch the numbers in the
  code move with the sliders. That detail is what the rest of the demo rests
  on: the source already carries every change I make."

## Agent variation

**Step 4 — hand the groove to the agent.**

- DO: Ask the agent: "Keep the bass and kick exactly where I left them. Make
  the hats evolve over eight bars instead of staying static." Keep the camera
  on the editor and the transport.
- SAY: "Now the agent joins — reading the same editor I'm looking at."

**Step 5 — watch it read, edit, and evaluate.**

- DO: Let the tool calls land: `strudel_get_context`, `strudel_get_code`,
  `strudel_apply_edits`, `strudel_evaluate`. After each call, glance at the
  footer status — `get_context ✓`, `apply_edits ✓` — the quiet trail every
  tool call leaves, reads included.
- SAY: "It reads the live state, edits only the hats line, and makes it
  audible. Playback never dropped out — the pattern swapped on the running
  clock. Only the hats changed."

**Step 6 — point at a selection.**

- DO: Select the bass expression with the mouse. Ask: "Make this less busy in
  the second half, but don't touch anything else."
- SAY: "I just select code — no line numbers, no explanation. The agent reads
  my selection as 'this' and edits inside it."

**Step 7 — win a stale write on purpose.**

- DO: While the agent works, drag the bass cutoff slider once more, then say:
  "Yeah, keep that value. Make the texture respond to it better."
- SAY: "My slider move already changed the code under it. If the agent had
  reused its old read, it would get STALE_CODE and change nothing — the human
  always wins. It re-reads, keeps my value untouched, and edits the
  texture line instead."

**Step 8 — ask what changed.**

- DO: Ask: "Which bit is opening the hats now?" The agent calls
  `strudel_focus_range`; the exact expression highlights and scrolls into
  view.
- SAY: "It doesn't cite a line number — it shows me, in my own editor."

## Proposal

**Step 9 — turn the dial to Review.**

- DO: Click **Review** in the header dial. Ask: "Swap the kick for a different
  one — but let me check it first."
- SAY: "This dial is mine. In review, the agent can't touch my code — it can
  only propose."

**Step 10 — read the proposal.**

- DO: The `strudel_apply_edits` call returns `{proposed: true}` with a diff.
  A proposal bar appears: summary, line span, diff. Point at each part. Note
  the music and the source haven't changed.
- SAY: "A code-review suggestion, not agent chrome. Nothing sounds different
  yet — I'm still in charge."

**Step 11 — audition, then decide.**

- DO: Click **Audition** (or let the agent audition with
  `strudel_evaluate({proposalId})`). The notice reads "Auditioning the
  proposed change" while the proposal — not the document — is what sounds.
  Listen, then click **Accept**: the edit lands, the music updates in place.
- SAY: "I hear it before it exists. Accept, and it's mine now."
- DO (optional): Mention Read mode denies every mutation outright
  (`MODE_DENIED`) — even the agent's evaluate and stop — while reading,
  recording, and pointing stay available.

## Record take

**Step 12 — give the agent ears.**

- DO: While the groove plays, ask: "Record four seconds and tell me: is the
  bass too loud?" The header Rec button shows a live timer; the call returns
  peak/RMS in dBFS, a loudness curve, and low/mid/high band levels. A take
  with a waveform lands in the Takes shelf — press play on it yourself.
- SAY: "It answers with numbers, not vibes — and the take is in my page, not
  its head. A take is a take, whoever pressed record: I can stop its
  recording with my Rec button, and stopping playback ends it gracefully."

**Step 13 — isolate one voice (closer).**

- DO: If time allows: add `.analyze("kick")` to the kick, evaluate, and ask
  the agent to record `source: "kick"`. Or show `untilStopped`: recording
  runs until a human presses Rec again.
- SAY: "Per-voice isolation, same pipeline — the agent hears exactly what
  I hear."

## Safety net

**Step 14 — snapshot before the big swing.**

- DO: Ask: "Load a clap from the catalogue you actually have — snap a version
  first, and use it." Tool calls: `strudel_snapshot` (a "before" version
  appears in Versions: restore, export, open at strudel.cc),
  `strudel_list_sounds({query: "clap"})`, `strudel_apply_edits` +
  `strudel_evaluate` using a listed name.
- SAY: "Versions are my undo for the whole session. And new sounds land in
  the same registry my `s("...")` resolves against — drag a file onto the
  page and it sits next to the agent-loaded ones."

## Final line

- DO: Let the groove play out. Close on:
- SAY: "The agent isn't controlling another Strudel session. It's playing in
  the one I'm already performing in."
