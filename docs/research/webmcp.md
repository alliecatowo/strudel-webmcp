# WebMCP check (spec index.bs + README, webmachinelearning/webmcp, 2026-09-02)

No material deviations from the contract's assumptions. Confirmed:

- Entry point is `document.modelContext` (not `navigator.modelContext`).
- `registerTool(tool, { signal?, exposedTo? })` returns `Promise<void>`; abort the signal to unregister.
- `tool = { name, title?, description, inputSchema?, execute, annotations? }`.
- `annotations = { readOnlyHint?: boolean, untrustedContentHint?: boolean }`.
- `execute(inputObject, { signal: AbortSignal })` returns any JSON-serializable value (spec serializes the fulfilled value to JSON). A rejected promise yields a generic failure with no payload, so structured errors should be **returned**, not thrown.
- `toolchange` fires only on registration/unregistration; there is no page-to-agent notification channel.
- Types: `webmcp-types` npm package (`Document.modelContext?: WebMCP.ModelContext`), pinned as a devDependency.
- Support: Chrome 149 origin trial, Edge 150 origin trial, ChatGPT Desktop, Brave Leo (per implementation-status.md).
