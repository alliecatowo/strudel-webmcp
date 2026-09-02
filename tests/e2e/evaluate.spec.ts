import { test, expect } from '@playwright/test';
import {
  callTool,
  editorDoc,
  getHash,
  humanGesturePlay,
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
}
interface EvalResult {
  ok: true;
  playing: boolean;
  codeHash: string;
}
interface ContextResult {
  playback: { playing: boolean; lastEvaluationError?: string };
}

async function trackStartedEvents(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const host = document.querySelector('strudel-editor')!;
    (window as unknown as { __startedLog: boolean[] }).__startedLog = [];
    host.addEventListener('update', (e) => {
      const detail = (e as CustomEvent<{ started?: boolean }>).detail;
      (window as unknown as { __startedLog: boolean[] }).__startedLog.push(Boolean(detail?.started));
    });
  });
}

function startedLog(page: import('@playwright/test').Page): Promise<boolean[]> {
  return page.evaluate(() => (window as unknown as { __startedLog: boolean[] }).__startedLog ?? []);
}

test.describe('strudel_evaluate (sections 30-31, 78-79)', () => {
  test('evaluates an agent edit on the running scheduler without stopping/restarting it', async ({ page }) => {
    await openWithShim(page);
    await humanGesturePlay(page);
    await trackStartedEvents(page);

    const before = await editorDoc(page);
    const hash = await getHash(page);
    const from = before.indexOf('hh*8');
    expect(from).toBeGreaterThan(-1);
    const edit = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: hash,
      edits: [{ range: { start: positionFromOffset(before, from), end: positionFromOffset(before, from + 4) }, text: 'hh*16' }],
    });

    const result = await callTool<EvalResult>(page, 'strudel_evaluate', { expectedCodeHash: edit.codeHash });
    expect(result.ok).toBe(true);
    expect(result.playing).toBe(true);

    expect(await schedulerStarted(page)).toBe(true);
    const log = await startedLog(page);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((s) => s === true)).toBe(true);

    const edited = await editorDoc(page);
    await expect.poll(async () => (await replState(page)).activeCode).toBe(edited);
  });

  test('a stale hash is rejected and activeCode is unchanged', async ({ page }) => {
    await openWithShim(page);
    await humanGesturePlay(page);
    const staleHash = await getHash(page);
    await humanType(page, '\n// stale attempt marker\n');
    const activeBefore = (await replState(page)).activeCode;

    const result = await callTool<ToolError>(page, 'strudel_evaluate', { expectedCodeHash: staleHash });
    expect(result.error).toBe('STALE_CODE');
    expect((await replState(page)).activeCode).toBe(activeBefore);
  });

  test('an evaluation error returns a bounded diagnostic, keeps the scheduler started, and the app stays usable', async ({
    page,
  }) => {
    await openWithShim(page);
    await humanGesturePlay(page);
    const before = await editorDoc(page);
    const hash = await getHash(page);
    const from = before.indexOf('// hats');
    expect(from).toBeGreaterThan(-1);
    const broken = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: hash,
      edits: [{ range: positionRange(before, from), text: 'this is not valid(\n// hats' }],
    });

    const evalErr = await callTool<ToolError>(page, 'strudel_evaluate', { expectedCodeHash: broken.codeHash });
    expect(evalErr.error).toBe('EVALUATION_ERROR');
    expect(typeof evalErr.message).toBe('string');
    expect(Number.isInteger(evalErr.line)).toBe(true);
    expect(Number.isInteger(evalErr.column)).toBe(true);

    expect(await schedulerStarted(page)).toBe(true);

    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(ctx.playback.lastEvaluationError).toBeTruthy();

    // The app remains usable: typing still works.
    await humanType(page, '\n// still usable after an eval error\n');
    await expect.poll(() => editorDoc(page)).toContain('// still usable after an eval error');

    // Fix it by replacing the whole doc with the original pattern and evaluate successfully.
    const fixHash = await getHash(page);
    await callTool(page, 'strudel_replace_code', { expectedCodeHash: fixHash, code: before });
    const freshHash = await getHash(page);
    const fixed = await callTool<EvalResult>(page, 'strudel_evaluate', { expectedCodeHash: freshHash });
    expect(fixed.ok).toBe(true);
  });

  test('aborting immediately returns ABORTED', async ({ page }) => {
    await openWithShim(page);
    await humanGesturePlay(page);
    const hash = await getHash(page);
    const result = await callTool<ToolError>(page, 'strudel_evaluate', { expectedCodeHash: hash }, 0);
    expect(result.error).toBe('ABORTED');
  });
});

function positionRange(code: string, from: number) {
  return { start: positionFromOffset(code, from), end: positionFromOffset(code, from) };
}
