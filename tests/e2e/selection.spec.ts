import { test, expect } from '@playwright/test';
import {
  callTool,
  cmHasFocus,
  cmSelection,
  dblClickInLine,
  editorDoc,
  getHash,
  humanType,
  offsetFromPosition,
  openWithShim,
  positionFromOffset,
  setSelection,
  type ToolError,
} from './helpers';

interface ContextResult {
  playback: { playing: boolean; dirty: boolean };
  editor: {
    codeHash: string;
    cursor: { line: number; column: number; offset: number };
    selection: {
      empty: boolean;
      start: { line: number; column: number };
      end: { line: number; column: number };
      fromOffset: number;
      toOffset: number;
      text: string;
    };
  };
}

interface FocusResult {
  focused: true;
  codeHash: string;
  range: { start: { line: number; column: number }; end: { line: number; column: number }; fromOffset: number; toOffset: number };
}

test.describe('strudel_get_context: human selection (section 73)', () => {
  test('a selection made through the CodeMirror API (as a mouse drag would) is reported exactly', async ({ page }) => {
    await openWithShim(page);
    const code = await editorDoc(page);
    const target = 's("bd*4")';
    const anchor = code.indexOf(target);
    expect(anchor).toBeGreaterThan(-1);
    const head = anchor + target.length;
    await setSelection(page, anchor, head);

    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(ctx.editor.selection.text).toBe(target);
    expect(ctx.editor.selection.empty).toBe(false);
    expect(ctx.editor.selection.fromOffset).toBe(anchor);
    expect(ctx.editor.selection.toOffset).toBe(head);
    expect(ctx.editor.selection.start).toEqual(positionFromOffset(code, anchor));
    expect(ctx.editor.selection.end).toEqual(positionFromOffset(code, head));
    expect(ctx.editor.cursor.offset).toBe(head);
  });

  test('a real double-click selection is reported exactly', async ({ page }) => {
    await openWithShim(page);
    await dblClickInLine(page, '// kick', 0.85);
    const sel = await cmSelection(page);
    expect(sel.to).toBeGreaterThan(sel.from);

    const code = await editorDoc(page);
    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(ctx.editor.selection.fromOffset).toBe(sel.from);
    expect(ctx.editor.selection.toOffset).toBe(sel.to);
    expect(ctx.editor.selection.text).toBe(code.slice(sel.from, sel.to));
  });
});

test.describe('strudel_focus_range (sections 34, 74)', () => {
  test('selects the given range, focuses the editor, and scrolls it into view', async ({ page }) => {
    await openWithShim(page);
    const code = await editorDoc(page);
    const target = '// bass';
    const from = code.indexOf(target);
    expect(from).toBeGreaterThan(-1);
    const to = from + target.length;
    const range = { start: positionFromOffset(code, from), end: positionFromOffset(code, to) };
    const hash = await getHash(page);

    const res = await callTool<FocusResult>(page, 'strudel_focus_range', { range, expectedCodeHash: hash });
    expect(res.focused).toBe(true);
    expect(res.range.fromOffset).toBe(from);
    expect(res.range.toOffset).toBe(to);

    const sel = await cmSelection(page);
    expect(sel.from).toBe(from);
    expect(sel.to).toBe(to);
    expect(await cmHasFocus(page)).toBe(true);
  });

  test('an invalid range fails with INVALID_RANGE', async ({ page }) => {
    await openWithShim(page);
    const res = await callTool<ToolError>(page, 'strudel_focus_range', {
      range: { start: { line: 0, column: 0 }, end: { line: 9999, column: 0 } },
    });
    expect(res.error).toBe('INVALID_RANGE');
  });

  test('a stale expectedCodeHash fails with STALE_CODE and leaves the selection unchanged', async ({ page }) => {
    await openWithShim(page);
    const code = await editorDoc(page);
    const staleHash = await getHash(page);
    await humanType(page, '\n// moved the doc on\n');

    const before = await cmSelection(page);
    const target = '// snare';
    const from = code.indexOf(target);
    const to = from + target.length;
    const res = await callTool<ToolError>(page, 'strudel_focus_range', {
      range: { start: positionFromOffset(code, from), end: positionFromOffset(code, to) },
      expectedCodeHash: staleHash,
    });
    expect(res.error).toBe('STALE_CODE');

    const after = await cmSelection(page);
    expect(after).toEqual(before);
  });

  test('offsetFromPosition/positionFromOffset round-trip (sanity check for the assertions above)', async ({ page }) => {
    await openWithShim(page);
    const code = await editorDoc(page);
    const offset = Math.floor(code.length / 2);
    const pos = positionFromOffset(code, offset);
    expect(offsetFromPosition(code, pos.line, pos.column)).toBe(offset);
  });
});
