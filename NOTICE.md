# NOTICE

Strudel WebMCP
Copyright (C) 2026 Allison Coleman

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only). See
[LICENSE](./LICENSE) for the full text.

## Built on Strudel

This project embeds the official `@strudel/repl` web component, pinned at version
**1.2.0**, directly and without an iframe.

- Project: [Strudel](https://strudel.cc) — a browser-based live coding environment
  for algorithmic music.
- Source: https://github.com/tidalcycles/strudel
- License: AGPL-3.0-or-later
- Authors: Felix Roos and contributors

Strudel WebMCP does not vendor or fork Strudel's source; it depends on the
published `@strudel/repl` npm package and drives it through its public/documented
element and CodeMirror APIs. See [docs/UPSTREAM.md](./docs/UPSTREAM.md) for exactly
which objects this project touches and how the version is pinned.

## Default demo sample banks

The seed pattern in `src/demo-pattern.ts` uses Strudel's built-in synths
(`sawtooth`, `triangle`) and the `RolandTR909` drum bank, which Strudel loads at
startup via its own `prebake` step from the following upstream sources:

- **tidal-drum-machines** — drum machine samples for SuperDirt/Tidal, referenced by
  Strudel's prebake as `github:ritchse/tidal-drum-machines`. That GitHub path now
  redirects to https://github.com/geikha/tidal-drum-machines (the repository was
  transferred to a new owner). GitHub reports no detected license file for this
  repository (`license: null` via the GitHub API as of 2026-09-02). No license text
  could be independently verified; treat provenance as unconfirmed and attribute
  honestly rather than assume public domain or permissive terms.
- **Dirt-Samples** — https://github.com/tidalcycles/Dirt-Samples. GitHub also
  reports no detected license file for this repository (`license: null` as of
  2026-09-02).
- Both are fetched by Strudel at runtime from
  https://github.com/felixroos/dough-samples (the CDN host Strudel's prebake
  points at for these banks), which itself also reports no detected license
  (`license: null` as of 2026-09-02).

None of these sample assets are vendored in this repository; they are fetched at
runtime by Strudel's own sample-loading code, exactly as they are for any Strudel
user. This project does not redistribute them.

## Type definitions

- **webmcp-types** (`webmcp-types@0.1.5`) — TypeScript type definitions for
  WebMCP's `document.modelContext` API, used only as a devDependency for type
  checking; nothing from it ships in the built application.
  - Source: https://github.com/webmachinelearning/webmcp-types
  - License: MIT (see `node_modules/webmcp-types/LICENSE` when installed)
