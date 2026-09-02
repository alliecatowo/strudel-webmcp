ONE-SHOT BUILD CONTRACT — STRUDEL WEBMCP

Build this project completely for the OpenAI WebMCP Challenge.

This specification intentionally resolves product, architecture, implementation strategy, testing strategy, demo flow, licensing, scope, and agent allocation up front.

Token budget matters.

DO NOT re-ideate the product.

DO NOT build a new music application.

DO NOT fork the full Strudel website unless the embedded REPL proves technically impossible.

DO NOT build an MCP server.

DO NOT build an AI music application.

DO NOT build an AI chat interface.

The submission is:

«The normal Strudel live-coding REPL, progressively enhanced so a compatible browser agent can join the exact live performance session the human is already manipulating.»

Continue until:

- normal Strudel REPL works
- audio/live coding works
- inline controls work
- human editor changes are readable through WebMCP
- human inline-slider changes are readable through WebMCP
- agent edits visibly modify the same CodeMirror editor
- agent evaluation updates the same playing Strudel runtime
- human edits cannot be overwritten by stale agent work
- human selection is shared with agent
- agent can focus/select code for human
- tests pass
- public HTTPS deployment works
- repository is properly AGPL licensed
- upstream attribution is complete
- challenge documentation/demo is complete

---

0. FIRST ACTION — VENDOR THIS CONTRACT

Save this complete prompt verbatim to:

docs/BUILD_CONTRACT.md

Create:

CLAUDE.md

containing:

# Project instructions

The authoritative implementation specification is:

docs/BUILD_CONTRACT.md

Read it before making architectural decisions.

Core rules:

- This is Strudel + WebMCP, not an AI music app.
- Use the official @strudel/repl web component directly, top-level, without iframe.
- Pin the Strudel version.
- Preserve Strudel's AGPL licensing requirements.
- The application remains a normal fully-functional Strudel REPL without WebMCP.
- WebMCP operates the exact live editor/runtime the human is using.
- Never maintain an agent-only copy of the Strudel source.
- Never execute hidden Strudel source.
- Agent edits must appear in the visible editor before evaluation.
- Human edits always win via code-hash stale-write protection.
- Inline slider changes are human edits and must invalidate stale agent writes.
- Use Strudel/CodeMirror APIs, not DOM scraping, for authoritative state.
- WebMCP cannot proactively trigger an agent on state changes.
- No AI SDK, no chat UI, no MCP server, no WebSocket bridge.
- Do not re-ideate the product.

Create:

docs/DECISIONS.md

Only document actual deviations:

Decision:
Why BUILD_CONTRACT could not be followed:
Evidence:
Replacement:

No brainstorming journal.

---

1. PRODUCT

Working name:

Strudel WebMCP

Tagline:

«Live-code together.»

Technical tagline:

«WebMCP for the live Strudel REPL.»

Description:

«Strudel WebMCP lets a compatible browser agent read, edit, navigate, and evaluate the exact Strudel composition a human is already performing with—including unsaved code, selections, and inline control changes—without embedding an LLM or configuring an MCP server.»

---

2. CORE PRODUCT BOUNDARY

This is NOT:

an AI beat generator
an AI composition service
an AI DJ
a Strudel MCP server
a new Strudel clone
a chat interface
a prompt-to-music product

Without WebMCP the application must still be:

a completely normal Strudel live coding environment

Human users can:

- write Strudel
- edit patterns
- play
- stop
- update/evaluate
- use inline sliders
- use built-in visual feedback
- use CodeMirror
- make music

No agent required.

---

3. WHY THIS IS WEBMCP

The interesting object is NOT a ".strudel" file.

The interesting object is:

the exact live Strudel performance in this browser tab

That includes:

- current unsaved CodeMirror document
- current human source selection
- current cursor position
- current inline slider values
- live playback state
- current in-browser scheduler
- current pattern
- current audio context
- built-in Strudel source highlighting
- current scratch composition

The human might never save anything.

They may:

open Strudel
make a beat
perform for 20 minutes
close the tab

This is disposable/live browser state.

WebMCP lets the browser agent accompany that session directly.

---

4. HONEST COMPARISON TO EXISTING MCP APPROACHES

Existing Strudel MCP projects already demonstrate that agents can control Strudel through:

MCP server
        ↓
WebSocket / SSE
        ↓
special Strudel frontend

Some require a separate session ID copied between browser and agent.

Do NOT pretend this capability is impossible with MCP.

Our actual argument is simpler:

Traditional Strudel MCP

Requires:

- connector/server
- bridge
- session synchronization
- MCP configuration
- often a special frontend/session ID

Strudel WebMCP

Requires:

open the Strudel page

The page itself publishes its semantic controls.

The same browser agent that accompanies the user can join the REPL automatically.

No external bridge.

No session ID.

No agent-specific server.

No secondary source of truth.

---

5. COMPETITION POSITIONING

OpenAI already showcases beat sequencing as a WebMCP use case.

DO NOT claim:

«nobody has thought of agents editing music.»

Instead execute the interaction exceptionally well.

Our distinct angle is:

«WebMCP as progressive enhancement for an existing mature browser-native live-coding instrument.»

Emphasize:

same live editor
same inline controls
same scheduler
same playing pattern
same human changes

Not generative-AI novelty.

---

6. UPSTREAM STRATEGY

DO NOT clone the entire Strudel repository as the application unless required.

Create a small new application around:

@strudel/repl

Use the official:

<strudel-editor>

web component.

Pin the package to an exact tested version.

Target initially:

@strudel/repl 1.2.0

If package availability/current package metadata requires another 1.2.x stable release, use that exact version and record it.

Do not use:

@strudel/embed

because that uses an iframe.

Do not iframe:

strudel.cc

WebMCP registration must occur on the top-level page and the live editor must be available directly.

---

7. LICENSE — NON-NEGOTIABLE

Strudel uses:

AGPL-3.0

The official Strudel documentation specifically requires compatible open-source licensing for integrations/derivative works.

Therefore this repository is:

AGPL-3.0

Do not waste tokens researching ways around it.

Public source is already required for the challenge.

Include:

LICENSE
NOTICE.md
docs/UPSTREAM.md

Document:

Strudel
@strudel/repl
tested version
official project/source identity
AGPL-3.0
date integration began

Also preserve any required attribution/licensing for default sound banks used by the demo.

---

8. BUILD STACK

Use:

Vite
TypeScript
Vitest
Playwright
@strudel/repl

Do not add React unless absolutely required.

The REPL itself already supplies the important UI.

Prefer a minimal vanilla TypeScript host.

No:

Next.js
database
backend
WebSocket server
Express
Supabase
Firebase
Tailwind
component library
state-management framework

unless an actual blocker requires one.

This should be a static site.

---

9. REPOSITORY STRUCTURE

Use approximately:

strudel-webmcp/
├── CLAUDE.md
├── LICENSE
├── NOTICE.md
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── index.html
│
├── docs/
│   ├── BUILD_CONTRACT.md
│   ├── DECISIONS.md
│   ├── UPSTREAM.md
│   ├── architecture.md
│   ├── webmcp-tools.md
│   ├── demo-script.md
│   └── submission.md
│
├── src/
│   ├── main.ts
│   │
│   ├── strudel/
│   │   ├── adapter.ts
│   │   ├── editor.ts
│   │   ├── playback.ts
│   │   ├── selection.ts
│   │   ├── revisions.ts
│   │   └── types.ts
│   │
│   ├── webmcp/
│   │   ├── register.ts
│   │   ├── tools.ts
│   │   ├── schemas.ts
│   │   ├── results.ts
│   │   └── errors.ts
│   │
│   └── ui/
│       └── status.ts
│
├── tests/
│   ├── unit/
│   ├── webmcp-shim.ts
│   └── e2e/
│
└── public/

Keep it tiny.

---

10. NORMAL APP SHELL

The page should mostly be the Strudel REPL.

Conceptually:

┌──────────────────────────────────────────────┐
│ Strudel WebMCP                 WebMCP ready  │
├──────────────────────────────────────────────┤
│                                              │
│                                              │
│             <strudel-editor>                 │
│                                              │
│                                              │
└──────────────────────────────────────────────┘

Do not redesign Strudel.

Do not make a dashboard.

A tiny header/status strip is enough.

If the embedded component already supplies all necessary surrounding controls, maximize its viewport.

---

11. DEFAULT DEMO COMPOSITION

Seed the editor with a polished but understandable pattern.

It should include:

- kick
- snare
- hats
- bass/synth
- at least one inline "slider(...)"

Use a musically convincing but not huge pattern.

Keep source around:

10-25 lines

Enough for obvious human/agent partial editing.

Example shape only:

setcps(0.55)

stack(
  // kick
  ...,

  // snare
  ...,

  // hats with inline slider
  ...gain(slider(...)),

  // bass / synth with inline cutoff control
  ...lpf(slider(...))
)

Do not blindly use this pseudocode if exact Strudel syntax differs.

Verify the final fixture manually.

Prefer standard included Strudel sounds that load reliably.

---

12. BROWSER AUDIO POLICY

Browsers may require a user gesture before WebAudio can start.

DO NOT attempt to bypass autoplay policy.

Expected demo:

human manually presses Play once

This arms/starts audio.

After that, agent can modify/evaluate the live performance.

If agent attempts play before browser permits audio:

return:

AUDIO_GESTURE_REQUIRED

with:

«Start playback once using the Strudel UI, then try again.»

This is acceptable and honest.

---

13. MODEL / TOKEN STRATEGY

This should be a very small build.

Use cheap workers.

Haiku

Use for:

- pinned REPL API reconnaissance
- CodeMirror API locations
- slider-state investigation
- final audit

Sonnet

Use for:

- adapter
- WebMCP tools
- stale editing
- integration tests

Strong lead

Use for:

- architecture enforcement
- seam integration
- debugging hard runtime issues
- final completion

Do not use giant mass fanout.

Maximum useful concurrency:

3 workers

---

14. EXACT SCOUT PHASE

Run TWO narrow Haiku scouts.

No other broad research.

---

15. HAIKU SCOUT A — PINNED STRUDEL REPL INTERNALS

READ ONLY.

Prompt exactly:

«Inspect the exact installed/pinned @strudel/repl version only.

We embed "<strudel-editor>" directly in a top-level Vite page.

Find the smallest supported/working paths to:

1. obtain the REPL/editor instance from the custom element
2. read the complete current CodeMirror document
3. replace/edit CodeMirror source programmatically
4. obtain cursor position
5. obtain source selection range and selected text
6. set cursor/selection and scroll into view
7. evaluate the CURRENT visible source exactly as Strudel's Update action does
8. play/start using the native REPL path
9. stop/hush using the native REPL path
10. determine whether playback is currently running
11. determine how inline slider() widgets update source/runtime

Known likely structure from existing integrations, VERIFY rather than assume:

- host.editor
- host.editor.editor as CodeMirror EditorView
- host.editor.repl
- host.editor.repl.evaluate(...)
- host.editor.repl.scheduler.started

Do not explore unrelated Strudel packages.

Do not redesign the app.

Write a concise memo:

docs/research/strudel-repl.md

Include exact object paths/functions and pinned package source locations.

If an object path is internal/unstable, explicitly say so and recommend the narrowest adapter around it.»

---

16. HAIKU SCOUT B — WEBMCP CHECK

READ ONLY.

Prompt:

«Verify only the current WebMCP assumptions needed by this project:

- document.modelContext.registerTool
- imperative tools
- execute callback with AbortSignal
- readOnlyHint
- untrustedContentHint
- registration AbortSignal
- toolchange is not an arbitrary state event

Do not brainstorm product features.

Write only material deviations to:

docs/research/webmcp.md

If none, keep file under 20 lines.»

---

17. AFTER SCOUTS

Lead reads each memo once.

Freeze adapter interface.

No additional Strudel architecture exploration unless implementation hits a concrete blocker.

---

18. INTERNAL ADAPTER

Create one narrow object:

interface StrudelAdapter {
  getCode(): string;

  getContext(): StrudelContext;

  applyEdits(
    edits: SourceEdit[],
    expectedCodeHash: string
  ): EditResult;

  replaceCode(
    code: string,
    expectedCodeHash: string
  ): EditResult;

  evaluate(
    expectedCodeHash: string
  ): Promise<EvaluationResult>;

  play(
    expectedCodeHash: string
  ): Promise<PlaybackResult>;

  stop(): Promise<PlaybackResult>;

  focusRange(
    range: SourceRange,
    expectedCodeHash?: string
  ): FocusResult;
}

WebMCP depends on this.

Do not put CodeMirror internals directly inside tool callbacks.

---

19. AUTHORITATIVE STATE

There is ONE source of truth:

the visible Strudel CodeMirror document

NOT:

WebMCP copy
local JS string
agent session state
server

Every tool invocation reads current editor state.

This is mandatory.

---

20. CODE HASH

Use deterministic hash over exact editor source.

Example:

FNV-1a
xxHash
stable lightweight equivalent

Cryptographic security unnecessary.

Return:

codeHash

on every source read/mutation.

The purpose is collaborative concurrency safety.

---

21. CRITICAL STALE-WRITE RULE

Agent must never overwrite human changes made after its read.

Flow:

Agent reads source → hash A
Human types something / moves slider
Source becomes hash B
Agent tries edit with expected hash A
        ↓
STALE_CODE

Reject mutation.

Agent rereads.

Human wins.

This applies equally to:

typing
pasting
deleting
inline slider changes

A slider move IS a source change.

---

22. SOURCE POSITION FORMAT

All public WebMCP ranges use:

{
  "start": {
    "line": 0,
    "column": 0
  },
  "end": {
    "line": 0,
    "column": 10
  }
}

Lines and columns are:

zero-based

Internally convert to CodeMirror offsets.

Also return offsets where useful:

{
  "fromOffset": 14,
  "toOffset": 27
}

This makes precise targeted edits easy.

---

23. WEBMCP TOOL SET

Implement exactly these core tools:

strudel_get_context
strudel_get_code
strudel_apply_edits
strudel_replace_code
strudel_evaluate
strudel_play
strudel_stop
strudel_focus_range

Eight tools.

Do not proliferate 40 tiny tools.

---

24. "strudel_get_context"

READ ONLY.

Return:

{
  "playback": {
    "playing": true,
    "audioReady": true
  },

  "editor": {
    "codeHash": "...",
    "length": 824,

    "cursor": {
      "line": 8,
      "column": 17,
      "offset": 221
    },

    "selection": {
      "empty": false,

      "start": {
        "line": 8,
        "column": 4
      },

      "end": {
        "line": 8,
        "column": 29
      },

      "fromOffset": 208,
      "toOffset": 233,

      "text": "s(\"hh*8\").gain(...)"
    }
  }
}

Include only reliable runtime data.

If exact "audioReady" cannot be reliably known:

omit it.

Do not invent values.

Selected text must be bounded.

Tool:

readOnlyHint = true
untrustedContentHint = true

because source is user-authored content.

---

25. "strudel_get_code"

READ ONLY.

Input:

{
  "startLine": 0,
  "endLine": 100
}

Both optional.

If omitted:

return full source within bounds.

Result:

{
  "code": "...",
  "codeHash": "...",
  "lineCount": 24,
  "truncated": false
}

Default code is small, so full source is fine.

Set:

readOnlyHint = true
untrustedContentHint = true

---

26. SOURCE OUTPUT BOUND

Protect against malicious/huge source.

Suggested:

max full source returned: 100 KB
max selected text: 20 KB

If larger:

require line-range reads.

Return explicit truncation.

---

27. "strudel_apply_edits"

MUTATING VISIBLE SOURCE.

Input:

{
  "expectedCodeHash": "...",

  "edits": [
    {
      "range": {
        "start": {
          "line": 7,
          "column": 0
        },

        "end": {
          "line": 7,
          "column": 34
        }
      },

      "text": "..."
    }
  ]
}

Requirements:

- expectedCodeHash required
- edits must not overlap
- validate ranges
- apply atomically in one CodeMirror transaction where practical
- preserve normal undo behavior
- source visibly changes
- do NOT evaluate automatically

Return:

{
  "updated": true,
  "codeHash": "...",
  "changes": 1
}

This is preferred for ordinary agent edits.

---

28. "strudel_replace_code"

MUTATING VISIBLE SOURCE.

Useful when user asks:

«“Start over with a minimal techno groove.”»

Input:

{
  "expectedCodeHash": "...",
  "code": "..."
}

Requirements:

- stale guard
- visible CodeMirror replacement
- normal editor remains usable
- do not evaluate automatically

Do not use hidden runtime source.

---

29. WHY EDIT AND EVALUATE ARE SEPARATE

This is deliberate.

Editing code:

changes the document

Evaluating:

changes the live musical runtime

Separating them provides:

- transparency
- user control
- safer agent behavior
- easier tests
- same conceptual model as human Strudel editing

An agent can compose:

apply_edits
→ evaluate

---

30. "strudel_evaluate"

MUTATING LIVE PERFORMANCE.

Input:

{
  "expectedCodeHash": "..."
}

Behavior:

- verify visible editor still matches hash
- evaluate the CURRENT VISIBLE source using Strudel's native REPL evaluation path
- do not execute an externally supplied hidden source string
- if already playing:
  - update active pattern while preserving ongoing performance/clock behavior
- if stopped:
  - evaluate according to normal Strudel Update semantics
  - do not unexpectedly bypass autoplay restrictions

Return:

{
  "ok": true,
  "playing": true,
  "codeHash": "..."
}

If compile/evaluation fails:

return structured error with bounded diagnostic.

Do not hide error from normal Strudel UI if native behavior displays it.

---

31. LIVE UPDATE IS A HERO FEATURE

The desired experience is:

music is already playing
        ↓
agent edits hats
        ↓
agent evaluates
        ↓
next pattern scheduling uses changed pattern
        ↓
clock/performance continues

Avoid stopping/restarting playback when merely updating source if native Strudel can preserve continuity.

This is central to the demo.

---

32. "strudel_play"

MUTATING LIVE PERFORMANCE.

Input:

{
  "expectedCodeHash": "..."
}

Use native Strudel play path.

Do not invent a parallel scheduler.

If browser requires user gesture:

return:

{
  "error": "AUDIO_GESTURE_REQUIRED",
  "message": "Start playback once from the Strudel UI to enable browser audio."
}

Do not attempt to hack around browser policy.

---

33. "strudel_stop"

MUTATING.

No input required.

Use normal Strudel hush/stop functionality.

Return:

{
  "playing": false
}

---

34. "strudel_focus_range"

VIEW-STATE mutation only.

Input:

{
  "expectedCodeHash": "...",

  "range": {
    "start": {
      "line": 6,
      "column": 2
    },

    "end": {
      "line": 6,
      "column": 28
    }
  }
}

Behavior:

- stale-check if expected hash supplied
- set CodeMirror selection
- move cursor
- scroll into view
- focus editor

Use native CodeMirror selection visuals.

No custom AI highlight.

This lets agent say:

«“This is the bass line I'm talking about.”»

and visibly select it.

---

35. HUMAN → AGENT SELECTION

Human manually selects:

s("hh*8").gain(...)

Then asks:

«“Make just this build over eight bars.”»

Agent:

strudel_get_context

receives exact source selection.

Then:

strudel_get_code
strudel_apply_edits
strudel_evaluate

No line-number description required.

This is a critical collaboration interaction.

---

36. AGENT → HUMAN SELECTION

Human asks:

«“What did you change?”»

Agent uses:

strudel_focus_range

to select exact source.

Then explains in chat.

This gives bidirectional shared referents.

---

37. INLINE SLIDERS — HERO INTERACTION

Strudel's CodeMirror inline "slider(...)" control updates:

live runtime value
+
the numeric literal in the editor source

Therefore:

Human

drags inline cutoff slider.

Immediately

visible source changes.

Therefore

"codeHash" changes.

Agent

later reads:

strudel_get_code

and sees exact new value.

No slider-specific WebMCP bridge required.

This is excellent.

---

38. DO NOT IMPLEMENT "strudel_set_slider" FOR V1

The agent can modify visible source.

Human can use the tactile slider.

This creates complementary control:

human direct manipulation
        ↕
shared source/runtime
        ↕
agent structural editing

Do not add redundant slider tool.

---

39. SLIDER STALE-WRITE TEST

MANDATORY.

Test:

1. agent reads codeHash A
2. human/Playwright moves an actual inline Strudel slider
3. source changes to hash B
4. attempt "strudel_apply_edits" with A
5. receives "STALE_CODE"
6. slider's human value remains untouched

This proves shared state correctly.

---

40. OPTIONAL "controls" CONTEXT

ONLY if pinned REPL exposes stable slider widget metadata cheaply.

Then "strudel_get_context" MAY include:

{
  "controls": [
    {
      "type": "slider",
      "value": 1200,
      "range": {
        "start": {...},
        "end": {...}
      }
    }
  ]
}

Do not parse/reverse-engineer sliders just to add this.

The source already carries the important value.

---

41. NO HIDDEN EVALUATION

Never expose:

strudel_eval_arbitrary_code(code)

where the code does not become visible.

The agent must:

edit visible document
→ evaluate visible document

The same artifact remains understandable to the human.

---

42. NO AGENT TRIGGERS

WebMCP does not wake the agent.

Therefore:

slider change
editor change
playback change
selection change

do not initiate agent work.

They only alter state the agent can read when the human invokes it.

No fake event channel.

No background callback.

---

43. ERROR MODEL

Use structured errors:

WEBMCP_UNAVAILABLE
REPL_NOT_READY
EDITOR_NOT_READY
STALE_CODE
INVALID_RANGE
OVERLAPPING_EDITS
SOURCE_TOO_LARGE
EVALUATION_ERROR
AUDIO_GESTURE_REQUIRED
PLAYBACK_ERROR
ABORTED
INTERNAL_ERROR

Example:

{
  "error": "STALE_CODE",
  "message": "The Strudel source changed since it was read.",
  "expectedCodeHash": "...",
  "currentCodeHash": "..."
}

No giant stack dumps.

---

44. EVALUATION ERRORS

Return useful bounded diagnostic:

{
  "error": "EVALUATION_ERROR",
  "message": "...",
  "line": 8,
  "column": 14
}

when available.

If Strudel itself displays an error:

preserve normal UI behavior.

The agent and human should see the same failure.

---

45. ABORT SIGNAL

Respect WebMCP execution AbortSignal.

Editing operations are synchronous/atomic and can check before dispatch.

For evaluation/play:

- stop awaiting if aborted
- do not report success after abort
- do not automatically hush a performance that may have been running before the tool call unless the tool itself started an isolated operation and safe cancellation exists

Do not overcomplicate cancellation.

---

46. WEBMCP ANNOTATIONS

Read-only

strudel_get_context
strudel_get_code

set:

readOnlyHint = true
untrustedContentHint = true

because source is user-authored.

Mutating

strudel_apply_edits
strudel_replace_code
strudel_evaluate
strudel_play
strudel_stop
strudel_focus_range

readOnly false/omitted.

Execution/evaluation results derived from source may be untrusted where relevant.

---

47. PRODUCTION FEATURE DETECTION

Production must:

if (!("modelContext" in document)) {
  // no WebMCP registration
  // normal Strudel app still works
}

No fake production "modelContext".

---

48. TEST-ONLY WEBMCP SHIM

Create:

tests/webmcp-shim.ts

Capabilities:

- capture registrations
- inspect tool definitions
- execute callbacks
- pass AbortSignal
- simulate unregister via registration signal

Never ship it in production.

---

49. SMALL STATUS UI

Optional but recommended:

WebMCP ready · 8 tools

States:

WebMCP unavailable
WebMCP ready
WebMCP error

No:

AI connected
Claude online
agent status

WebMCP availability is the only thing we know.

---

50. NORMAL USER EXPERIENCE

A judge who never invokes an agent should still be able to:

load page
press Play
edit source
press Update
move sliders
hear changes
stop

If that fails:

submission fails.

---

51. DEFAULT DEMO MUSICAL DESIGN

Build an initial composition with obvious conceptual regions.

Use comments:

// kick

// snare

// hats

// bass

// texture / lead

This makes targeted selections visually legible.

Have at least TWO inline sliders:

hat gain / density-related audible parameter
bass cutoff

Do not use sliders for values that barely change the sound.

Slider movement must be audibly obvious.

---

52. DEMO SOUND QUALITY

This is a hackathon video.

The starting loop should sound good immediately.

Do not ship:

bd sd hh

and call it finished.

Spend a small amount of time making:

a polished 4/4 club-ish groove

with:

- clear kick
- groove
- hats
- bass
- some texture

But code should remain understandable.

Do not turn demo source into a 200-line masterpiece.

---

53. DEMO VIDEO — TARGET

Approximately:

90 seconds–2 minutes

Fast.

Audio is the wow factor.

---

54. GOLDEN DEMO SCENE 1 — NORMAL STRUDEL

Open site.

Narrate:

«“This is just Strudel, the browser live-coding environment. There's no AI SDK or agent backend.”»

Human manually clicks:

Play

Music starts.

Show editor visual feedback.

---

55. DEMO SCENE 2 — HUMAN DIRECT MANIPULATION

Human drags bass cutoff slider.

Make obvious audible change.

Then drag hat control.

Narrate briefly:

«“I'm changing the live performance normally.”»

Important:

the source numeric values visibly update.

---

56. DEMO SCENE 3 — AGENT JOINS CURRENT STATE

Ask browser agent:

«“Keep the bass and kick exactly where I left them. Make the hats evolve over eight bars instead of staying static.”»

Agent:

strudel_get_context
strudel_get_code
strudel_apply_edits
strudel_evaluate

It edits only hats.

Visible source changes.

Music changes WITHOUT stopping the performance.

This is the hero moment.

---

57. DEMO SCENE 4 — HUMAN SELECTION

Human manually selects only bass expression.

Ask:

«“Make this less busy in the second half, but don't touch anything else.”»

Agent receives exact selection.

Applies small edit.

Evaluates.

Live audio changes.

---

58. DEMO SCENE 5 — HUMAN CHANGES AGENT WORK

After agent's edit:

human manually tweaks one of the inline controls again.

Then:

«“Yeah, keep that value. Make the texture respond to it better.”»

Agent rereads new code hash.

Preserves slider value.

Updates texture.

Evaluates.

This visually reinforces shared live state.

---

59. DEMO SCENE 6 — AGENT POINTS BACK

Ask:

«“Which bit is opening the hats now?”»

Agent calls:

strudel_focus_range

Exact relevant expression becomes selected in CodeMirror.

Agent explains.

---

60. FINAL DEMO LINE

Use:

«“The agent isn't controlling another Strudel session. It's playing in the one I'm already performing in.”»

Then:

«“No MCP server, WebSocket bridge, or session ID—the page itself is the integration.”»

---

61. README OPENING

Use something close to:

# Strudel WebMCP

> Live-code together.

Strudel WebMCP progressively enhances the normal Strudel browser REPL with
semantic tools for the browser agent already accompanying the user.

The human can type, select code, move inline sliders, and perform normally.
The agent can read and edit that exact same CodeMirror document and evaluate
changes in the same live Strudel scheduler.

No AI SDK.
No MCP server.
No WebSocket bridge.
No session ID.

---

62. README — WHY WEBMCP

Include table:

                    Strudel MCP bridge       Strudel WebMCP

Setup               configure connector      open page
Bridge               MCP + websocket/SSE     none
Session identity     often explicit ID        current browser tab
Editor               synchronized copy/UI     exact live editor
Human slider changes synchronization layer    already same source
Runtime              bridged session          exact current REPL
AI embedded          maybe                    never

Do not insult existing MCP projects.

They solve a different deployment problem.

---

63. ARCHITECTURE DOC

Create:

docs/architecture.md

Diagram:

┌─────────────────────────────────────┐
│            Browser tab              │
│                                     │
│    <strudel-editor>                 │
│         │                           │
│         ├── CodeMirror document ◄── HUMAN
│         │        │                  │
│         │        ├── selection      │
│         │        └── sliders        │
│         │                           │
│         └── Strudel REPL            │
│              │                      │
│              └── scheduler/audio    │
│                                     │
│         ↕                           │
│   StrudelAdapter                    │
│         ↕                           │
│   WebMCP tools                      │
│         ↕                           │
│ document.modelContext               │
└──────────────┬──────────────────────┘
               │
               ▼
      compatible browser agent

---

64. WEBMCP TOOL DOC

Create:

docs/webmcp-tools.md

For every tool:

- name
- description
- input
- output
- mutation classification
- stale-state behavior
- errors
- bounds

Example:

strudel_apply_edits

Atomically edit one or more ranges of the currently visible Strudel
CodeMirror document.

Requires the codeHash returned by a previous read. If the human changes the
document—including by moving a Strudel inline slider—the edit is rejected
rather than overwriting the newer human state.

Does not evaluate the composition automatically.

---

65. SECURITY / TRUST

Strudel source is user-authored executable content.

Treat it as:

untrusted content

for WebMCP metadata purposes.

Do not use source code as privileged tool instructions.

Tool definitions are fixed/trusted.

Do not expose:

- unrelated localStorage
- browser cookies
- auth data
- arbitrary DOM content

The project has no backend secrets.

---

66. SOURCE MUTATION SAFETY

"strudel_apply_edits" must validate:

- hash
- range bounds
- overlaps
- total insertion size

Suggested max mutation payload:

100 KB

Do not let malformed edits corrupt editor state.

Apply all-or-nothing.

---

67. CODEMIRROR API RULE

Use CodeMirror APIs as authoritative editor control.

Do NOT do:

document.querySelector(".cm-content").innerText

for source.

Do NOT synthesize keyboard events to mutate editor.

Use:

EditorView.state.doc
EditorView.dispatch(...)
selection APIs

or exact equivalent in pinned version.

DOM selectors may be used only in tests or minor cosmetic status UI.

---

68. STRUDEL API RULE

Use native REPL methods.

Do NOT reimplement:

- transpiler
- evaluator
- scheduler
- audio engine
- slider system

That is the entire reason to use Strudel.

---

69. UNIT TESTS

Test:

hashing

same code → same hash.

changed code → different hash.

ranges

line/column ↔ offset.

edit validation

- valid single edit
- multiple non-overlap
- overlapping rejected
- invalid range rejected

stale

wrong hash rejected.

source bound

large payload rejected/truncated appropriately.

structured errors

normalized.

---

70. E2E — BASELINE

Without WebMCP shim:

- page loads
- "<strudel-editor>" initializes
- source editable
- normal human update works
- no extension crash

---

71. E2E — REGISTRATION

With shim:

expected eight tools registered exactly once.

No duplicate registrations.

---

72. E2E — GET CODE

Human edits source through CodeMirror.

"strudel_get_code" returns exact unsaved value.

CRITICAL.

---

73. E2E — HUMAN SELECTION

Human selects source through CodeMirror.

"strudel_get_context" returns:

- exact selected text
- exact range
- cursor

---

74. E2E — AGENT FOCUS

Invoke "strudel_focus_range".

Verify:

- CodeMirror selection changes
- editor focuses
- target scrolls into view if needed

---

75. E2E — APPLY EDIT

Read code/hash.

Apply targeted edit.

Verify visible editor changes.

Verify new hash.

Verify no evaluation occurs automatically.

---

76. E2E — STALE TYPING

1. read hash A
2. simulate human type
3. attempt edit with A
4. "STALE_CODE"
5. human source remains

CRITICAL.

---

77. E2E — INLINE SLIDER

Use actual seeded "slider(...)".

Move native slider through Playwright.

Verify:

- visible numeric source changes
- "strudel_get_code" sees new source
- codeHash changes

Then stale-write test against old hash.

CRITICAL.

This is one of the best technical tests in the repository.

---

78. E2E — EVALUATE

Given valid code:

invoke "strudel_evaluate".

Verify native REPL evaluation occurs.

If scheduler running:

verify it remains started.

If practical, inspect scheduler/pattern state.

Actual audible verification is manual, not CI requirement.

---

79. E2E — EVALUATION ERROR

Insert invalid Strudel code.

Evaluate.

Verify:

EVALUATION_ERROR

and application remains usable.

Then fix code and evaluate successfully.

---

80. E2E — PLAY / STOP

If browser automation permits audio startup:

test directly.

If browser autoplay makes reliable CI impossible:

unit/integration-test native method invocation and manually verify playback in demo QA.

Do not make CI flaky over browser audio policy.

---

81. VITE BUILD

Required commands:

npm ci
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run dev

Make them real.

Do not document fake commands.

---

82. DEPLOYMENT

Static HTTPS deployment.

Prefer:

Vercel
or
GitHub Pages

No server required.

Top-level application.

No iframe.

Ensure:

WebAudio
WebMCP
custom element

all function under HTTPS.

---

83. DEFAULT INITIAL AUDIO

Avoid automatic playback on page load.

User must click Play.

This is normal Strudel behavior and avoids policy problems.

---

84. PAGE TITLE / HEADER

Minimal:

Strudel WebMCP

Maybe small subtitle:

A live Strudel REPL with WebMCP

Do not oversell.

---

85. UPSTREAM ATTRIBUTION

Create:

docs/UPSTREAM.md

Include:

- Strudel project
- pinned package version
- AGPL license
- date integrated
- sample-bank attribution/licensing references where applicable

README:

«Built on Strudel, the browser-based live coding environment for algorithmic music.»

Do not obscure upstream.

---

86. CHALLENGE WORK DELTA

If useful, create:

docs/CHALLENGE_DELTA.md

Clarify:

Upstream

- live coding language
- CodeMirror REPL
- scheduler
- WebAudio
- sliders
- playback UI
- source highlighting

Challenge implementation

- live Strudel semantic adapter
- WebMCP tools
- human/agent selection sharing
- stale-source safety
- slider-aware concurrency behavior
- WebMCP lifecycle
- testing
- demo integration
- challenge docs

Do not claim Strudel itself as challenge work.

---

87. WEBMCP LEVERAGE POSITIONING

Use:

«The valuable state in a live-coding instrument is not merely a file. It's the unsaved composition, current source selection, inline control values, and currently-running scheduler in the browser tab the human is performing with.»

WebMCP exposes that exact state.

---

88. EXECUTION POSITIONING

Mention:

- official Strudel REPL
- official CodeMirror editor
- live source
- native scheduler
- live evaluation
- human selection
- agent selection
- inline slider propagation
- stale-write protection
- static deployment
- no bridge/server
- integration tests

---

89. IMPACT POSITIONING

Broader message:

«Browser-native creative tools should not need to embed their own model or require users to install a dedicated agent connector. WebMCP lets the application expose the same instrument the human already uses to whatever compatible browser agent accompanies them.»

Strudel is the musical proof.

---

90. CREATIVITY POSITIONING

Do not pitch:

«AI generated a beat.»

Pitch:

«A person and external browser agent are performing through the same live instrument.»

Human:

types
selects
drags controls
listens

Agent:

reads exact live state
makes precise structural edits
evaluates
points back into source

The audio immediately reflects both.

---

91. MAIN HUMAN/AGENT DIFFERENCE

Human has:

ears
tactile direct manipulation
performance instinct

Agent has:

structured source editing
pattern-generation ability
code transformation

But neither owns a separate state.

Both act through Strudel.

This is the collaboration story.

Do not over-philosophize it in the video.

Just show it.

---

92. NO DOCS / SEARCH TOOL

Do not implement:

strudel_search_docs
strudel_explain_function

The agent can access documentation through normal capabilities.

Those tools distract from the live-session thesis.

---

93. NO SAVED PROJECT SYSTEM

Do not build:

accounts
cloud saves
composition library
multiplayer
revision history

Strudel already has its own sharing behavior.

Not needed.

---

94. OPTIONAL STRETCH — SHARE

Only after everything is finished.

If the native embedded REPL provides a clean share-link API, expose:

strudel_share

using the same existing behavior.

Do not reverse-engineer/share backend just to add it.

---

95. OPTIONAL STRETCH — CONTROL INTROSPECTION

Only if native APIs make it trivial:

strudel_get_controls

Read-only list of inline sliders.

Not needed.

---

96. OPTIONAL STRETCH — ACTIVE MINI-LOCATION

Strudel internally tracks active source locations for its visual playback highlighting.

If the pinned API exposes current active location cleanly, "strudel_get_context" may report it.

This could let agent understand:

what source region is sounding now

BUT:

do not poll.

do not stream.

do not implement Channels.

do not delay core.

---

97. DO NOT BUILD

Explicitly out of scope:

MCP server
WebSocket bridge
SSE
Claude Channels
embedded chat
LLM API
agent skill server
music recommendation
sample generation
audio analysis AI
speech input
collaboration backend
accounts
database
DAW
timeline editor
piano roll
node graph
custom synthesizer
new scheduling system
custom CodeMirror

The existing instrument is enough.

---

98. FINAL HAIKU AUDIT

Run one audit worker.

Prompt:

«Audit this repository strictly against docs/BUILD_CONTRACT.md.

Do not suggest new features.

Find concrete blockers only.

Prioritize:

1. WebMCP current API correctness
2. normal Strudel broken without WebMCP
3. iframe usage
4. separate/agent-only source state
5. DOM scraping for editor correctness
6. stale human edits being overwritten
7. slider changes not updating WebMCP state
8. hidden evaluation
9. live evaluate stopping/restarting unnecessarily
10. browser audio policy handling
11. licensing/AGPL issues
12. build/test/deployment blockers

For each:

severity
file
failed contract section
smallest fix

If clean, say no blockers.»

One Sonnet fixer only for confirmed blockers.

---

99. ACCEPTANCE CRITERIA — NORMAL APP

Without WebMCP:

- Strudel loads
- editor works
- source is editable
- Play works
- Update/evaluate works
- Stop works
- inline slider works
- visual feedback works
- music is audible

---

100. ACCEPTANCE CRITERIA — WEBMCP

Required:

strudel_get_context
strudel_get_code
strudel_apply_edits
strudel_replace_code
strudel_evaluate
strudel_play
strudel_stop
strudel_focus_range

Using:

document.modelContext.registerTool

Current imperative API.

---

101. ACCEPTANCE CRITERIA — SAME EDITOR

Human type:

must be immediately returned by agent read

Agent edit:

must immediately appear to human

No synchronization server.

No second copy.

---

102. ACCEPTANCE CRITERIA — SAME LIVE PERFORMANCE

When playback already running:

agent edit
→ evaluate
→ audible pattern changes

without a separate Strudel runtime.

Prefer no clock reset/hush if native update supports continuity.

---

103. ACCEPTANCE CRITERIA — SELECTION

Human selection:

agent reads exact range/text

Agent focus:

human sees exact CodeMirror selection

---

104. ACCEPTANCE CRITERIA — SLIDERS

Human moves inline slider.

Required:

editor source changes
codeHash changes
agent reread sees value
stale old-hash write rejected

---

105. ACCEPTANCE CRITERIA — SAFETY

Agent source mutations require:

expectedCodeHash

Human always wins.

Evaluation runs only visible source.

No hidden code.

---

106. ACCEPTANCE CRITERIA — LICENSE

- repository AGPL-3.0
- public source
- upstream attribution
- Strudel attribution
- required sound/sample attribution

---

107. ACCEPTANCE CRITERIA — SUBMISSION

- public HTTPS site
- public repo
- license
- README
- architecture
- WebMCP tools doc
- demo script
- challenge submission text
- no secrets
- tests passing
- demo under challenge video limit

---

108. GOLDEN INTERACTION — THIS IS THE PRODUCT

Everything should optimize for:

HUMAN
presses Play
music starts

        ↓

HUMAN
drags bass cutoff slider
drags hat slider

        ↓

same CodeMirror source changes

        ↓

HUMAN
asks:
“Keep the bass and kick exactly where I left them.
Make the hats evolve over eight bars.”

        ↓

AGENT
reads exact live code/hash
edits hats only
evaluates visible code

        ↓

music changes while performance continues

        ↓

HUMAN
selects bass expression
asks:
“Make just this less busy in the second half.”

        ↓

AGENT
reads exact source selection
edits it
evaluates

        ↓

HUMAN
moves slider again

        ↓

AGENT
rereads new hash
preserves human value
continues composition

        ↓

AGENT
focuses exact code when asked what changed

No separate session exists.

No agent-specific frontend exists.

No MCP server exists.

The normal Strudel instrument simply became agent-accessible.

---

109. FINAL SUBMISSION COPY

Headline:

«Live-code together.»

Short description:

«Strudel WebMCP lets compatible browser agents participate in the exact live Strudel REPL a human is already performing with. Humans can type, select code, and move inline controls normally; agents can read and precisely edit that same unsaved CodeMirror document and evaluate changes in the same playing scheduler. No embedded LLM, MCP server, WebSocket bridge, or session ID.»

Core line:

«The agent isn't controlling another Strudel session. It's playing in yours.»

WebMCP line:

«The page is the integration.»

---

110. STOP CONDITION

Once:

normal Strudel works
shared source works
shared selection works
slider state works
stale safety works
live evaluation works
tests pass
public deployment works
docs complete
audit clean

STOP.

Do not add another music feature.

Do not rewrite the REPL.

Do not spend remaining tokens polishing architecture.

Record demo.

Ship.
