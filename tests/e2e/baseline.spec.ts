import { test, expect } from '@playwright/test';
import { editorDoc, humanType, openPlain, pressPlay, pressUpdate, replState, schedulerStarted } from './helpers';

// No WebMCP shim here: this is the plain, unenhanced Strudel REPL. It must work end to end
// without any agent involvement, per BUILD_CONTRACT section 50 / 99.
test.describe('baseline: normal Strudel REPL without WebMCP', () => {
  test('page loads with the right title', async ({ page }) => {
    await openPlain(page);
    await expect(page).toHaveTitle('Strudel WebMCP');
  });

  test('strudel-editor initializes with the seed pattern', async ({ page }) => {
    await openPlain(page);
    await expect(page.locator('.cm-content')).toBeVisible();
    const doc = await editorDoc(page);
    expect(doc).toContain('// kick');
    expect(doc).toContain('slider(');
  });

  test('status shows WebMCP unavailable without a shim', async ({ page }) => {
    await openPlain(page);
    await expect(page.locator('#webmcp-status')).toHaveText('WebMCP unavailable');
  });

  test('human can type into CodeMirror and the doc reflects it', async ({ page }) => {
    await openPlain(page);
    await humanType(page, '\n// human note');
    await expect.poll(() => editorDoc(page)).toContain('// human note');
  });

  test('Play starts the scheduler and toggles the button label', async ({ page }) => {
    await openPlain(page);
    await pressPlay(page);
    await expect(page.locator('#btn-play')).toHaveText('■ Stop');
    expect(await schedulerStarted(page)).toBe(true);
  });

  test('Update evaluates the visible source', async ({ page }) => {
    await openPlain(page);
    await humanType(page, '\n// before update');
    const doc = await editorDoc(page);
    await pressUpdate(page);
    await expect.poll(async () => (await replState(page)).activeCode).toBe(doc);
  });

  test('pressing Play again stops playback', async ({ page }) => {
    await openPlain(page);
    await pressPlay(page);
    await page.locator('#btn-play').click();
    await expect.poll(() => schedulerStarted(page)).toBe(false);
    await expect(page.locator('#btn-play')).toHaveText('▶ Play');
  });

  test('no uncaught page errors occur during normal use', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openPlain(page);
    await pressPlay(page);
    await humanType(page, '\n// still fine');
    await pressUpdate(page);
    await page.locator('#btn-play').click();
    expect(errors).toEqual([]);
  });
});
