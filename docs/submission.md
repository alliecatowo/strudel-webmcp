# Challenge submission

## Headline

«Live-code together.»

## Short description

«Strudel WebMCP lets compatible browser agents participate in the exact live
Strudel REPL a human is already performing with. Humans can type, select
code, and move inline controls normally; agents can read and precisely edit
that same unsaved CodeMirror document and evaluate changes in the same
playing scheduler. No embedded LLM, MCP server, WebSocket bridge, or session
ID.»

## Core line

«The agent isn't controlling another Strudel session. It's playing in yours.»

## WebMCP line

«The page is the integration.»

## WebMCP leverage

The valuable state in a live-coding instrument is not merely a file. It's the
unsaved composition, current source selection, inline control values, and
currently-running scheduler in the browser tab the human is performing with.
WebMCP exposes that exact state — `document.modelContext.registerTool` runs
on the same page, in the same tab, over the same CodeMirror document the
human sees, so there is nothing to synchronize and no second copy of the
composition to keep consistent.

## Execution

Strudel WebMCP wraps the official Strudel REPL and CodeMirror editor with a
narrow adapter (`src/strudel/adapter.ts`) and eight WebMCP tools
(`src/webmcp/tools.ts`) built on top of it. Every tool reads the live source
fresh; every mutating tool requires the `codeHash` from a previous read and
is rejected with `STALE_CODE` if the human changed anything since —
including by moving an inline slider, since Strudel's slider widgets rewrite
the source's numeric literals directly. Evaluation runs Strudel's own native
Update path (`host.editor.evaluate()`), so an agent's edit becomes audible
exactly the way a human's does, without stopping the clock if it's already
running. Both human selection and agent-directed selection are shared
through the same `EditorView` selection state (`strudel_get_context`,
`strudel_focus_range`). The whole thing is a static site — no server, no
bridge — deployed to GitHub Pages, with unit tests over the hashing/range/
edit-validation logic and Playwright end-to-end tests against the real
`<strudel-editor>`, including a dedicated test that moves an actual inline
slider and confirms a stale agent write against the pre-slider hash is
rejected.

## Impact

Browser-native creative tools should not need to embed their own model or
require users to install a dedicated agent connector. WebMCP lets the
application expose the same instrument the human already uses to whatever
compatible browser agent accompanies them. Strudel is the musical proof.

## Creativity

This isn't "AI generated a beat." It's a person and an external browser
agent performing through the same live instrument: the human types, selects,
drags controls, and listens; the agent reads exact live state, makes precise
structural edits, evaluates, and points back into the source. The audio
immediately reflects both, because neither one owns a separate state — both
act through Strudel.

## Honest comparison to existing MCP approaches

Existing Strudel MCP projects already demonstrate that agents can control
Strudel through an MCP server, a WebSocket/SSE bridge, and often a special
Strudel frontend or a session ID copied between browser and agent — this
capability is not new, and this project doesn't claim otherwise. The actual
difference is what setup it requires: a traditional Strudel MCP bridge needs
a connector or server, a bridge, session synchronization, and MCP
configuration, sometimes with a bespoke frontend. Strudel WebMCP requires
opening the page. The page itself publishes its semantic controls, and the
same browser agent already accompanying the user can join the REPL
automatically — no external bridge, no session ID, no agent-specific server,
no secondary source of truth.

## Links

- Repository: https://github.com/alliecatowo/strudel-webmcp
- Live site: https://alliecatowo.github.io/strudel-webmcp/
- Demo video: _placeholder — add link once recorded per `docs/demo-script.md`_
