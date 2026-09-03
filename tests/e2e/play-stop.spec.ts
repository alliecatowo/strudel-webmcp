import { test, expect } from '@playwright/test';
import { callTool, getHash, openWithShim, replState, schedulerStarted, type ToolError } from './helpers';

interface PlaybackResult {
  playing: boolean;
  codeHash: string;
}

test.describe('strudel_play / strudel_stop (sections 32-33, 80)', () => {
  test('before any human gesture, strudel_play either starts or requires a gesture honestly', async ({ page }) => {
    await openWithShim(page);
    const hash = await getHash(page);
    const result = await callTool<PlaybackResult & Partial<ToolError>>(page, 'strudel_play', { expectedCodeHash: hash });
    if (result.error) {
      expect(result.error).toBe('AUDIO_GESTURE_REQUIRED');
      expect(result.message).toContain('Play');
    } else {
      expect(result.playing).toBe(true);
    }
  });

  test('after a human click, strudel_play starts the scheduler and updates the button', async ({ page }) => {
    await openWithShim(page);
    await page.click('body');
    const hash = await getHash(page);
    const result = await callTool<PlaybackResult>(page, 'strudel_play', { expectedCodeHash: hash });
    expect(result.playing).toBe(true);
    await expect.poll(() => schedulerStarted(page)).toBe(true);
    await expect(page.locator('#btn-play')).toHaveText('Stop');
  });

  test('strudel_play while already playing returns playing:true without re-evaluating', async ({ page }) => {
    await openWithShim(page);
    await page.click('body');
    const hash = await getHash(page);
    await callTool<PlaybackResult>(page, 'strudel_play', { expectedCodeHash: hash });
    await expect.poll(() => schedulerStarted(page)).toBe(true);

    const activeBefore = (await replState(page)).activeCode;
    const hash2 = await getHash(page);
    const again = await callTool<PlaybackResult>(page, 'strudel_play', { expectedCodeHash: hash2 });
    expect(again.playing).toBe(true);
    expect((await replState(page)).activeCode).toBe(activeBefore);
  });

  test('strudel_stop stops the scheduler and updates the button', async ({ page }) => {
    await openWithShim(page);
    await page.click('body');
    const hash = await getHash(page);
    await callTool<PlaybackResult>(page, 'strudel_play', { expectedCodeHash: hash });
    await expect.poll(() => schedulerStarted(page)).toBe(true);

    const result = await callTool<PlaybackResult>(page, 'strudel_stop');
    expect(result.playing).toBe(false);
    await expect.poll(() => schedulerStarted(page)).toBe(false);
    await expect(page.locator('#btn-play')).toHaveText('Play');
  });

  test('strudel_get_context reflects playing:false after stop', async ({ page }) => {
    await openWithShim(page);
    await page.click('body');
    const hash = await getHash(page);
    await callTool<PlaybackResult>(page, 'strudel_play', { expectedCodeHash: hash });
    await expect.poll(() => schedulerStarted(page)).toBe(true);
    await callTool<PlaybackResult>(page, 'strudel_stop');
    await expect.poll(() => schedulerStarted(page)).toBe(false);

    const ctx = await callTool<{ playback: { playing: boolean } }>(page, 'strudel_get_context');
    expect(ctx.playback.playing).toBe(false);
  });
});
