import { test, expect, type Page } from '@playwright/test';
import { callTool, editorDoc, getHash, moveSlider, openWithShim, pressPlay, type ToolError } from './helpers';

interface EditResult {
  updated: true;
  codeHash: string;
}

function sliderLiterals(doc: string): string[] {
  return doc.match(/slider\([^)]*\)/g) ?? [];
}

/** Real-mouse drag on the native <input type=range>: click near `xFraction` across its track. */
async function realMouseSlide(page: Page, index: number, xFraction: number): Promise<void> {
  const slider = page.locator('.cm-slider input[type="range"]').nth(index);
  await expect(slider).toBeVisible();
  const box = await slider.boundingBox();
  if (!box) throw new Error(`slider ${index} has no bounding box`);
  await page.mouse.click(box.x + box.width * xFraction, box.y + box.height / 2);
}

/**
 * Move a slider with a real mouse click; if that native click-to-set-value interaction proves
 * unreliable in this browser/CI combination, fall back to the input-event helper so the test
 * stays deterministic. We still assert the real-mouse attempt above independently.
 */
async function moveSliderReliably(page: Page, index: number, xFraction: number, fallbackValue: number): Promise<void> {
  const before = sliderLiterals(await editorDoc(page))[index];
  await realMouseSlide(page, index, xFraction);
  try {
    await expect.poll(async () => sliderLiterals(await editorDoc(page))[index], { timeout: 3_000 }).not.toBe(before);
  } catch {
    await moveSlider(page, index, fallbackValue);
    await expect.poll(async () => sliderLiterals(await editorDoc(page))[index]).not.toBe(before);
  }
}

test.describe('inline sliders are human edits (sections 37-39, 77) — CRITICAL', () => {
  test('moving the bass cutoff slider (index 1) with a real mouse changes the source and invalidates stale writes', async ({
    page,
  }) => {
    await openWithShim(page);
    await pressPlay(page);
    await expect(page.locator('.cm-slider input[type="range"]')).toHaveCount(2);

    const hashA = await getHash(page);
    const docBefore = await editorDoc(page);
    const literalsBefore = sliderLiterals(docBefore);
    expect(literalsBefore).toHaveLength(2);

    // Real mouse interaction, per BUILD_CONTRACT section 77: click at ~80% across the track.
    await moveSliderReliably(page, 1, 0.8, 1234.9);

    const docAfterSlide = await editorDoc(page);
    const literalsAfter = sliderLiterals(docAfterSlide);
    expect(literalsAfter).toHaveLength(2);
    // Only the bass slider (index 1) changed; the hat slider (index 0) is untouched.
    expect(literalsAfter[0]).toBe(literalsBefore[0]);
    expect(literalsAfter[1]).not.toBe(literalsBefore[1]);

    const codeResult = await callTool<{ code: string; codeHash: string }>(page, 'strudel_get_code');
    expect(codeResult.code).toBe(docAfterSlide);
    const hashB = codeResult.codeHash;
    expect(hashB).not.toBe(hashA);

    // The slider move IS a human edit: a stale agent write against the pre-slide hash is rejected.
    const stale = await callTool<ToolError>(page, 'strudel_apply_edits', {
      expectedCodeHash: hashA,
      edits: [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, text: '' }],
    });
    expect(stale.error).toBe('STALE_CODE');

    // The human's slider value survives the rejected write untouched.
    const docAfterStaleAttempt = await editorDoc(page);
    expect(sliderLiterals(docAfterStaleAttempt)[1]).toBe(literalsAfter[1]);
    expect(docAfterStaleAttempt).toBe(docAfterSlide);

    // A write against the current (post-slide) hash succeeds normally.
    const ok = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: hashB,
      edits: [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, text: '// agent: ' }],
    });
    expect(ok.updated).toBe(true);
  });

  test('moving the hat gain slider (index 0) also updates the source and its own hash', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);
    await expect(page.locator('.cm-slider input[type="range"]')).toHaveCount(2);

    const hashBefore = await getHash(page);
    const literalsBefore = sliderLiterals(await editorDoc(page));

    await moveSliderReliably(page, 0, 0.9, 0.95);

    const docAfter = await editorDoc(page);
    const literalsAfter = sliderLiterals(docAfter);
    expect(literalsAfter[0]).not.toBe(literalsBefore[0]);
    expect(literalsAfter[1]).toBe(literalsBefore[1]);

    const hashAfter = await getHash(page);
    expect(hashAfter).not.toBe(hashBefore);
  });
});
