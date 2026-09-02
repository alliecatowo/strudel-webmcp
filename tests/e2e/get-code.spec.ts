import { test, expect } from '@playwright/test';
import { callTool, editorDoc, getHash, humanType, openWithShim, type ToolError } from './helpers';

interface CodeSlice {
  code: string;
  codeHash: string;
  lineCount: number;
  startLine: number;
  endLine: number;
  truncated: boolean;
}

test.describe('strudel_get_code', () => {
  test('reflects human keyboard edits exactly, with a changed hash', async ({ page }) => {
    await openWithShim(page);
    const before = await callTool<CodeSlice>(page, 'strudel_get_code');
    await humanType(page, '\n// typed by a human\n');
    const doc = await editorDoc(page);
    await expect
      .poll(async () => (await callTool<CodeSlice>(page, 'strudel_get_code')).code)
      .toBe(doc);
    const after = await callTool<CodeSlice>(page, 'strudel_get_code');
    expect(after.code).toBe(doc);
    expect(after.lineCount).toBe(doc.split('\n').length);
    expect(after.codeHash).not.toBe(before.codeHash);
  });

  test('a line-range read returns exactly the requested lines', async ({ page }) => {
    await openWithShim(page);
    const doc = await editorDoc(page);
    const lines = doc.split('\n');
    const startLine = 1;
    const endLine = Math.min(3, lines.length - 1);
    const expected = lines.slice(startLine, endLine + 1).join('\n');
    const slice = await callTool<CodeSlice>(page, 'strudel_get_code', { startLine, endLine });
    expect(slice.code).toBe(expected);
    expect(slice.startLine).toBe(startLine);
    expect(slice.endLine).toBe(endLine);
    expect(slice.lineCount).toBe(lines.length);
  });

  test('an invalid range (endLine before startLine) fails with INVALID_RANGE', async ({ page }) => {
    await openWithShim(page);
    const res = await callTool<ToolError>(page, 'strudel_get_code', { startLine: 3, endLine: 1 });
    expect(res.error).toBe('INVALID_RANGE');
  });

  test('codeHash from get_code matches a fresh hash after no changes', async ({ page }) => {
    await openWithShim(page);
    const a = await getHash(page);
    const b = await getHash(page);
    expect(a).toBe(b);
  });
});
