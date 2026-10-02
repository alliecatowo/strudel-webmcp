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
