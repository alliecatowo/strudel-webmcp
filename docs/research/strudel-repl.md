# @strudel/repl 1.2.0 — pinned internals memo

All paths verified in `node_modules/@strudel/repl/dist/index-nMvR4WyA.js` (the file
`dist/index.mjs` re-exports). CodeMirror (`@codemirror/state`, `@codemirror/view`) is
**bundled inside** that file, so this app must not import CodeMirror itself; it must use
the `EditorView` instance the element already owns.

| # | Need | Path | Stability |
|---|------|------|-----------|
| 1 | REPL/editor from element | `host = document.querySelector('strudel-editor')`; `host.editor` is a `StrudelMirror` (bundle: `class ED`, ~L38154), created synchronously in `connectedCallback` (~L38395). | Public-ish (used by strudel.cc docs); unstable internals. |
| 2 | Read doc | `host.editor.editor` is the CodeMirror `EditorView` (created by `PD`/initEditor ~L38098). `host.editor.editor.state.doc.toString()`. `host.editor.code` mirrors it via updateListener but the EditorView is authoritative. | CM6 public API |
| 3 | Edit doc | `host.editor.editor.dispatch({ changes: [{from,to,insert}, ...] })` — one transaction, undo-able. `host.editor.setCode(str)` does a full replace the same way (~L38270). | CM6 public API |
| 4 | Cursor | `view.state.selection.main.head`; `view.state.doc.lineAt(pos)` for line/column. | CM6 |
| 5 | Selection | `view.state.selection.main` (`from`,`to`,`empty`), `view.state.sliceDoc(from,to)`. | CM6 |
| 6 | Set selection + scroll | `view.dispatch({ selection: {anchor, head}, scrollIntoView: true }); view.focus()`. | CM6 |
| 7 | Evaluate as Update | `await host.editor.evaluate()` (~L38215): `this.flash(); await this.repl.evaluate(this.code)`. `repl.evaluate(code, autostart=true, hush=true)` (~L3319) transpiles, sets pattern via `scheduler.setPattern(pat, autostart)` and only *starts* the scheduler if not already started → live update preserves the clock. **Errors are swallowed**: it logs, sets `repl.state.evalError` and calls `onEvalError`; it never rejects. Detect failures by reading `host.editor.repl.state.evalError` after awaiting (state is the same mutated object; the element also dispatches an `update` CustomEvent with `detail = state`). Before eval `evalError` is reset to `undefined`. | internal, narrow |
| 8 | Play | strudel.cc's play button = evaluate when stopped (`toggle()` ~L38221: `started ? repl.stop() : evaluate()`). `repl.start()` alone throws if no pattern was ever set. Use `host.editor.evaluate()` when not started. | internal |
| 9 | Stop | `host.editor.stop()` → `repl.scheduler.stop()` (~L38218). | internal |
| 10 | Playing? | `host.editor.repl.scheduler.started` (boolean, Cyclist ~L3160). Also `update` event `detail.started`. | internal |
| 11 | Sliders | `SliderWidget` (index.js/L145 area): renders `<span class="cm-slider"><input type="range"></span>`; on `input` it dispatches `view.dispatch({changes:{from,to,insert:String(value)}})` replacing the numeric literal in the doc, then `window.postMessage({type:'cm-slider',...})` for the runtime. So a slider move **is a document change** (updateListener fires, hash changes). Widgets appear only after an evaluation (`afterEval` → `updateSliderWidgets`). | internal |

Other verified facts

- Custom element tag `strudel-editor`; `observedAttributes = ['code']`; setting the `code` attribute calls `editor.setCode`. Inner HTML (optionally inside an HTML comment) is also read as initial code on a `setTimeout(0)`.
- The editor DOM (`.cm-editor`) is inserted as a **sibling `<div>` after** the element, not inside it.
- No ready event; `host.editor` exists synchronously after `connectedCallback`. Sample loading is `prebake` (async, awaited inside `beforeEval`).
- `repl.state` fields: `code`, `activeCode`, `pattern`, `evalError`, `schedulerError`, `pending`, `started`, `isDirty`, `miniLocations`, `widgets`.
- Audio: `getAudioContext()` is internal (`ht`, ~L11889) and not exported from `@strudel/repl`; importing `@strudel/webaudio` separately would create a *second* context, so don't. The scheduler can start with a suspended context (silent). Use `navigator.userActivation.hasBeenActive` as the honest gesture signal for `AUDIO_GESTURE_REQUIRED`.
- Keyboard: Ctrl/Alt+Enter evaluates, Ctrl/Alt+. stops. The element ships **no Play/Stop buttons**, so the host page adds small ones that call `host.editor.evaluate()` / `host.editor.stop()` / `host.editor.toggle()`.
- Transpiler errors (acorn) carry `loc: {line (1-based), column (0-based)}`; runtime errors carry only `message`.

Adapter recommendation: wrap only `host.editor` (StrudelMirror), `host.editor.editor` (EditorView) and `host.editor.repl.{scheduler.started, state.evalError}` in `src/strudel/`. Nothing else.
