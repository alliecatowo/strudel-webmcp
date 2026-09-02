import { test, expect } from '@playwright/test';
import {
  callTool,
  editorDoc,
  getHash,
  humanType,
  openWithShim,
  positionFromOffset,
  replState,
  schedulerStarted,
  type ToolError,
} from './helpers';

interface EditResult {
  updated: true;
  codeHash: string;
  changes: number;
  length: number;
  lineCount: number;
}

function rangeFor(code: string, needle: string): { range: { start: unknown; end: unknown }; from: number; to: number } {
  const from = code.indexOf(needle);
  expect(from, `"${needle}" not found in doc`).toBeGreaterThan(-1);
  const to = from + needle.length;
  return { range: { start: positionFromOffset(code, from), end: positionFromOffset(code, to) }, from, to };
}

test.describe('strudel_apply_edits (sections 27, 75-76)', () => {
  test('a targeted single-line edit changes exactly that text and does not evaluate', async ({ page }) => {
    await openWithShim(page);
    const before = await editorDoc(page);
    const hash = await getHash(page);
    const activeBefore = (await replState(page)).activeCode;
    const { range } = rangeFor(before, 'hh*8');

    const result = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: hash,
      edits: [{ range, text: 'hh*16' }],
    });
    expect(result.updated).toBe(true);
    expect(result.changes).toBe(1);

    const expectedDoc = before.replace('hh*8', 'hh*16');
    const after = await editorDoc(page);
    expect(after).toBe(expectedDoc);

    const fresh = await callTool<{ codeHash: string }>(page, 'strudel_get_code');
    expect(result.codeHash).toBe(fresh.codeHash);

    expect((await replState(page)).activeCode).toBe(activeBefore);
    expect(await schedulerStarted(page)).toBe(false);
  });

  test('multiple non-overlapping edits apply atomically in one transaction', async ({ page }) => {
    await openWithShim(page);
    const before = await editorDoc(page);
    const hash = await getHash(page);
    const kick = rangeFor(before, '// kick');
    const snare = rangeFor(before, '// snare');

    const result = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: hash,
      edits: [
        { range: kick.range, text: '// KICK' },
        { range: snare.range, text: '// SNARE' },
      ],
    });
    expect(result.changes).toBe(2);

    const after = await editorDoc(page);
    expect(after).toBe(before.replace('// kick', '// KICK').replace('// snare', '// SNARE'));
  });

  test('overlapping edits are rejected with OVERLAPPING_EDITS and the doc is unchanged', async ({ page }) => {
    await openWithShim(page);
    const before = await editorDoc(page);
    const hash = await getHash(page);
    const from = before.indexOf('hh*8');
    expect(from).toBeGreaterThan(-1);
    const editA = { start: positionFromOffset(before, from), end: positionFromOffset(before, from + 4) };
    const editB = { start: positionFromOffset(before, from + 2), end: positionFromOffset(before, from + 6) };

    const result = await callTool<ToolError>(page, 'strudel_apply_edits', {
      expectedCodeHash: hash,
      edits: [
        { range: editA, text: 'AAAA' },
        { range: editB, text: 'BBBB' },
      ],
    });
    expect(result.error).toBe('OVERLAPPING_EDITS');
    expect(await editorDoc(page)).toBe(before);
  });

  test('a stale hash after human typing is rejected, and human text survives untouched', async ({ page }) => {
    await openWithShim(page);
    const before = await editorDoc(page);
    const staleHash = await getHash(page);
    await humanType(page, '\n// human was here\n');
    const { range } = rangeFor(before, '// kick');

    const result = await callTool<ToolError>(page, 'strudel_apply_edits', {
      expectedCodeHash: staleHash,
      edits: [{ range, text: '// AGENT_EDIT_SHOULD_NOT_APPEAR' }],
    });
    expect(result.error).toBe('STALE_CODE');

    const doc = await editorDoc(page);
    expect(doc).toContain('// human was here');
    expect(doc).not.toContain('AGENT_EDIT_SHOULD_NOT_APPEAR');
  });

  test('a missing expectedCodeHash fails with INVALID_INPUT', async ({ page }) => {
    await openWithShim(page);
    const before = await editorDoc(page);
    const { range } = rangeFor(before, '// kick');
    const result = await callTool<ToolError>(page, 'strudel_apply_edits', {
      edits: [{ range, text: '// nope' }],
    });
    expect(result.error).toBe('INVALID_INPUT');
  });

  test('Control+z after an agent edit restores the previous doc (normal undo behaviour)', async ({ page }) => {
    // Agent edits are dispatched with their own CodeMirror userEvent, so a single Ctrl+Z reverts
    // exactly the agent edit and leaves the human's earlier work (and the seed) intact.

    await openWithShim(page);
    const before = await editorDoc(page);
    const hash = await getHash(page);
    const { range } = rangeFor(before, '// kick');
    await callTool<EditResult>(page, 'strudel_apply_edits', { expectedCodeHash: hash, edits: [{ range, text: '// KICK' }] });
    expect(await editorDoc(page)).not.toBe(before);

    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+z');
    await expect.poll(() => editorDoc(page)).toBe(before);
  });
});

test.describe('strudel_replace_code (section 28)', () => {
  const NEW_CODE = 'setcps(0.5)\nstack(\n  s("bd*4")\n)\n';

  test('replaces the whole doc without evaluating, given a fresh hash', async ({ page }) => {
    await openWithShim(page);
    const hash = await getHash(page);
    const activeBefore = (await replState(page)).activeCode;

    const result = await callTool<EditResult>(page, 'strudel_replace_code', { expectedCodeHash: hash, code: NEW_CODE });
    expect(result.updated).toBe(true);

    expect(await editorDoc(page)).toBe(NEW_CODE);
    const fresh = await callTool<{ codeHash: string }>(page, 'strudel_get_code');
    expect(result.codeHash).toBe(fresh.codeHash);
    expect((await replState(page)).activeCode).toBe(activeBefore);
  });

  test('a stale hash is rejected with STALE_CODE and the doc is unchanged', async ({ page }) => {
    await openWithShim(page);
    const staleHash = await getHash(page);
    await humanType(page, '\n// keep me\n');

    const result = await callTool<ToolError>(page, 'strudel_replace_code', { expectedCodeHash: staleHash, code: NEW_CODE });
    expect(result.error).toBe('STALE_CODE');
    expect(await editorDoc(page)).not.toBe(NEW_CODE);
    expect(await editorDoc(page)).toContain('// keep me');
  });
});
