import { expect, type Page } from '@playwright/test';
import { installWebMcpShim } from '../webmcp-shim';

export interface ToolError {
  error: string;
  message: string;
  [k: string]: unknown;
}

export async function openWithShim(page: Page): Promise<void> {
  await page.addInitScript(installWebMcpShim);
  await page.goto('/');
  await expect(page.locator('#webmcp-status')).toHaveText(/WebMCP ready · 8 tools/);
  await expect(page.locator('.cm-content')).toBeVisible();
}

export async function openPlain(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

export function callTool<T = Record<string, unknown>>(page: Page, name: string, input: Record<string, unknown> = {}, abortAfterMs?: number): Promise<T> {
  return page.evaluate(
    ([n, i, a]) => (window as unknown as { __webmcp: { call: (n: string, i: unknown, a?: number) => Promise<unknown> } }).__webmcp.call(n, i, a),
    [name, input, abortAfterMs] as const,
  ) as Promise<T>;
}

/** Read the visible editor document through the CodeMirror API (test-side truth). */
export function editorDoc(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('strudel-editor') as unknown as { editor: { editor: { state: { doc: { toString(): string } } } } };
    return host.editor.editor.state.doc.toString();
  });
}

export function schedulerStarted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.querySelector('strudel-editor') as unknown as { editor: { repl: { scheduler: { started: boolean } } } };
    return Boolean(host.editor.repl.scheduler.started);
  });
}

export function replState(page: Page): Promise<{ activeCode: string; evalError?: string; started: boolean }> {
  return page.evaluate(() => {
    const host = document.querySelector('strudel-editor') as unknown as {
      editor: { repl: { state: { activeCode: string; evalError?: Error; started: boolean } } };
    };
    const s = host.editor.repl.state;
    return { activeCode: s.activeCode, evalError: s.evalError?.message, started: s.started };
  });
}

/** Type into the editor as a human would (real keyboard events through CodeMirror). */
export async function humanType(page: Page, text: string): Promise<void> {
  await page.locator('.cm-content').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
}

/** Move a native inline slider like a human drag (fires the same `input` event). */
export async function moveSlider(page: Page, index: number, value: number): Promise<void> {
  const slider = page.locator('.cm-slider input[type="range"]').nth(index);
  await expect(slider).toBeVisible();
  await slider.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

export async function pressPlay(page: Page): Promise<void> {
  const doc = await editorDoc(page);
  await page.locator('#btn-play').click();
  await expect.poll(() => schedulerStarted(page), { timeout: 30_000 }).toBe(true);
  // Wait for the evaluation itself (and the slider widget refresh it triggers) to settle.
  await expect.poll(async () => (await replState(page)).activeCode, { timeout: 30_000 }).toBe(doc);
}

export async function pressUpdate(page: Page): Promise<void> {
  await page.locator('#btn-update').click();
}

export async function getHash(page: Page): Promise<string> {
  const res = await callTool<{ codeHash: string }>(page, 'strudel_get_code');
  return res.codeHash;
}

/** The CodeMirror EditorView's current selection, read straight from the live editor state. */
export function cmSelection(page: Page): Promise<{ from: number; to: number }> {
  return page.evaluate(() => {
    const host = document.querySelector('strudel-editor') as unknown as {
      editor: { editor: { state: { selection: { main: { from: number; to: number } } } } };
    };
    const sel = host.editor.editor.state.selection.main;
    return { from: sel.from, to: sel.to };
  });
}

export function cmHasFocus(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.querySelector('strudel-editor') as unknown as { editor: { editor: { hasFocus: boolean } } };
    return Boolean(host.editor.editor.hasFocus);
  });
}

/** Set the CodeMirror selection the way a mouse drag would produce (a single dispatch). */
export async function setSelection(page: Page, anchor: number, head: number): Promise<void> {
  await page.evaluate(
    ([a, h]) => {
      const host = document.querySelector('strudel-editor') as unknown as {
        editor: { editor: { dispatch(spec: unknown): void } };
      };
      host.editor.editor.dispatch({ selection: { anchor: a, head: h } });
    },
    [anchor, head] as const,
  );
}

/** Real-mouse double-click on a word inside the CodeMirror line containing `lineSubstring`. */
export async function dblClickInLine(page: Page, lineSubstring: string, xFraction = 0.7): Promise<void> {
  const line = page.locator('.cm-line', { hasText: lineSubstring }).first();
  await expect(line).toBeVisible();
  const box = await line.boundingBox();
  if (!box) throw new Error(`line containing "${lineSubstring}" has no bounding box`);
  await page.mouse.dblclick(box.x + box.width * xFraction, box.y + box.height / 2);
}

/** Pure zero-based line/column -> offset conversion, computed independently of src/ for assertions. */
export function offsetFromPosition(code: string, line: number, column: number): number {
  const lines = code.split('\n');
  let offset = 0;
  for (let i = 0; i < line; i++) offset += (lines[i]?.length ?? 0) + 1;
  return offset + column;
}

/** Pure offset -> zero-based line/column conversion, computed independently of src/ for assertions. */
export function positionFromOffset(code: string, offset: number): { line: number; column: number } {
  const lines = code.split('\n');
  let remaining = offset;
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i]?.length ?? 0;
    if (remaining <= len) return { line: i, column: remaining };
    remaining -= len + 1;
  }
  const lastLine = lines.length - 1;
  return { line: lastLine, column: lines[lastLine]?.length ?? 0 };
}

/** Establish a genuine user gesture (click) then get playback started via the strudel_play tool. */
export async function humanGesturePlay(page: Page): Promise<void> {
  await page.click('body');
  const hash = await getHash(page);
  const res = await callTool<{ playing?: boolean; error?: string }>(page, 'strudel_play', { expectedCodeHash: hash });
  expect(res.playing).toBe(true);
  await expect.poll(() => schedulerStarted(page), { timeout: 30_000 }).toBe(true);
}
