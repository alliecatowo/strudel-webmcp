import { test, expect, type Page } from '@playwright/test';
import { callTool, editorDoc, openWithShim, pressPlay, replState, type ToolError } from './helpers';

interface ContextResult {
  playback: { playing: boolean; dirty: boolean };
  editor: { codeHash: string };
  sounding?: { text: string; fromOffset: number; toOffset: number }[];
  agent: {
    mode: 'read' | 'review' | 'live';
    proposal?: { id: string; summary: string; stale: boolean };
    auditioning: boolean;
    solo?: { fromOffset: number; toOffset: number };
  };
  theme?: string;
}

interface ProposalResult {
  proposed: true;
  proposalId: string;
  summary: string;
  baseCodeHash: string;
  changes: number;
  lineRange: { start: number; end: number };
  diff: string;
  awaiting: 'human';
}

interface EditResult {
  updated: true;
  codeHash: string;
  changes: number;
  evaluation?: { ok: true; playing: boolean; scope: 'document' | 'solo' | 'audition' };
}

interface EvalResult {
  ok: true;
  playing: boolean;
  codeHash: string;
  scope: 'document' | 'solo' | 'audition';
}

interface RecordResult {
  recorded: true;
  clipId: string;
  label: string;
  mimeType: string;
  bytes: number;
  durationMs: number;
  sampleRate: number;
  channels: number;
  peakDbfs: number;
  rmsDbfs: number;
  silent: boolean;
  loudnessDbfs: number[];
  bandsDb: { low: number; mid: number; high: number };
  codeHash: string;
  source: string;
  audioBase64?: string;
}

async function setMode(page: Page, mode: 'read' | 'review' | 'live'): Promise<void> {
  await page.locator(`#mode-control [data-mode="${mode}"]`).click();
  await expect(page.locator('#mode-control')).toHaveAttribute('data-mode', mode);
}

function lineOf(doc: string, substring: string): { line: number; text: string } {
  const lines = doc.split('\n');
  const line = lines.findIndex((l) => l.includes(substring));
  expect(line, `seed pattern should contain "${substring}"`).toBeGreaterThan(-1);
  return { line, text: lines[line]! };
}

test.describe('agent modes (read / review / live)', () => {
  test('read mode: mutating tools return MODE_DENIED and the document is untouched', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);
    await setMode(page, 'read');

    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(ctx.agent.mode).toBe('read');
    const before = await editorDoc(page);

    const edit = await callTool<ToolError>(page, 'strudel_apply_edits', {
      expectedCodeHash: ctx.editor.codeHash,
      edits: [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, text: '// x\n' }],
    });
    expect(edit.error).toBe('MODE_DENIED');

    const replace = await callTool<ToolError>(page, 'strudel_replace_code', {
      expectedCodeHash: ctx.editor.codeHash,
      code: 's("bd")',
    });
    expect(replace.error).toBe('MODE_DENIED');

    for (const [name, input] of [
      ['strudel_evaluate', { expectedCodeHash: ctx.editor.codeHash }],
      ['strudel_stop', {}],
      ['strudel_set_theme', { theme: 'nord' }],
      ['strudel_load_samples', { sources: { beep: 'https://example.com/a.wav' } }],
    ] as const) {
      const denied = await callTool<ToolError>(page, name, { ...input });
      expect(denied.error, `${name} should be denied in read mode`).toBe('MODE_DENIED');
    }

    // Reading, pointing, snapshotting and recording stay available in read mode.
    const focus = await callTool<{ focused: true }>(page, 'strudel_focus_range', {
      range: { start: { line: 0, column: 0 }, end: { line: 0, column: 6 } },
    });
    expect(focus.focused).toBe(true);
    expect(await editorDoc(page)).toBe(before);
  });

  test('review mode: edits become a proposal; the document changes only when the human accepts', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);
    await setMode(page, 'review');

    const doc = await editorDoc(page);
    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    const hats = lineOf(doc, 'hh*8');
    const col = hats.text.indexOf('hh*8');

    const prop = await callTool<ProposalResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: ctx.editor.codeHash,
      edits: [{ range: { start: { line: hats.line, column: col }, end: { line: hats.line, column: col + 4 } }, text: 'hh*16' }],
      summary: 'Double the hats',
    });
    expect(prop.proposed).toBe(true);
    expect(prop.summary).toBe('Double the hats');
    expect(prop.changes).toBe(1);
    expect(prop.awaiting).toBe('human');
    expect(prop.diff).toContain('hh*16');

    // A proposal never touches the document.
    expect(await editorDoc(page)).toBe(doc);
    await expect(page.locator('#proposal-bar')).toBeVisible();
    await expect(page.locator('#proposal-summary')).toHaveText('Double the hats');

    const withProposal = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(withProposal.agent.proposal).toMatchObject({ id: prop.proposalId, summary: 'Double the hats', stale: false });

    // Audition plays the proposal's code while the document still shows the old source.
    const audition = await callTool<EvalResult>(page, 'strudel_evaluate', {
      expectedCodeHash: withProposal.editor.codeHash,
      proposalId: prop.proposalId,
    });
    expect(audition.scope).toBe('audition');
    expect(audition.playing).toBe(true);
    await expect(page.locator('#playback-notice')).toBeVisible();
    await expect(page.locator('#playback-notice')).toHaveAttribute('data-kind', 'audition');
    expect((await replState(page)).activeCode).toContain('hh*16');
    expect(await editorDoc(page)).toBe(doc);

    // Accepting applies the change and returns the runtime to the document.
    await page.locator('#btn-proposal-accept').click();
    await expect.poll(() => editorDoc(page)).toContain('hh*16');
    await expect(page.locator('#proposal-bar')).toBeHidden();
    await expect(page.locator('#playback-notice')).toBeHidden();
    await expect.poll(async () => (await replState(page)).activeCode).toContain('hh*16');

    const after = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(after.agent.proposal).toBeUndefined();
    expect(after.agent.auditioning).toBe(false);
  });

  test('live mode: solo evaluates just the selected range; a full Update clears it', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);
    await setMode(page, 'live');

    const doc = await editorDoc(page);
    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    const bass = lineOf(doc, '// bass');
    const bassLine = bass.line + 1;
    const bassText = doc.split('\n')[bassLine]!;

    const solo = await callTool<EvalResult>(page, 'strudel_evaluate', {
      expectedCodeHash: ctx.editor.codeHash,
      range: { start: { line: bassLine, column: 2 }, end: { line: bassLine, column: bassText.length } },
    });
    expect(solo.scope).toBe('solo');
    expect(solo.playing).toBe(true);

    // Only the bass is sounding: the kick's source is blanked out in the evaluated copy.
    const active = (await replState(page)).activeCode;
    expect(active).toContain('sawtooth');
    expect(active).not.toContain('bd*4');
    await expect(page.locator('#playback-notice')).toBeVisible();
    await expect(page.locator('#playback-notice')).toHaveAttribute('data-kind', 'solo');

    const soloCtx = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(soloCtx.agent.solo).toMatchObject({ fromOffset: doc.indexOf(bassText.trim()) });
    await expect
      .poll(async () => (await callTool<ContextResult>(page, 'strudel_get_context')).sounding?.length ?? 0)
      .toBeGreaterThan(0);

    // A human Update returns to the whole document and clears the solo notice.
    await page.locator('#btn-update').click();
    await expect(page.locator('#playback-notice')).toBeHidden();
    await expect.poll(async () => (await replState(page)).activeCode).toBe(doc);
  });

  test('live mode: apply_edits with evaluate:true updates the music in one call', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);

    const hash = (await callTool<ContextResult>(page, 'strudel_get_context')).editor.codeHash;
    const result = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: hash,
      edits: [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, text: '// live edit\n' }],
      evaluate: true,
    });
    expect(result.updated).toBe(true);
    expect(result.evaluation?.scope).toBe('document');
    expect(result.evaluation?.playing).toBe(true);
    const doc = await editorDoc(page);
    await expect.poll(async () => (await replState(page)).activeCode).toBe(doc);
  });
});

test.describe('shared-state reconciliation', () => {
  test('reads leave a quiet notice trail in the status strip', async ({ page }) => {
    await openWithShim(page);
    const activity = page.locator('#webmcp-status .status-activity');
    await callTool(page, 'strudel_get_code');
    await expect(activity).toHaveText(/get_code ✓/);
    await callTool(page, 'strudel_get_context');
    await expect(activity).toHaveText(/get_context ✓/);
    await callTool(page, 'strudel_list_sounds', { query: 'bd', limit: 5 });
    await expect(activity).toHaveText(/list_sounds ✓/);
    // Failures surface there too.
    const bad = await callTool<ToolError>(page, 'strudel_apply_edits', {
      expectedCodeHash: 'stale-hash',
      edits: [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, text: '// x' }],
    });
    expect(bad.error).toBe('STALE_CODE');
    await expect(activity).toHaveText(/apply_edits ✕ STALE_CODE/);
  });

  test('a human evaluation on the native path clears a solo notice', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);

    const doc = await editorDoc(page);
    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    const bass = lineOf(doc, '// bass');
    const bassLine = bass.line + 1;
    const bassText = doc.split('\n')[bassLine]!;
    const solo = await callTool<EvalResult>(page, 'strudel_evaluate', {
      expectedCodeHash: ctx.editor.codeHash,
      range: { start: { line: bassLine, column: 2 }, end: { line: bassLine, column: bassText.length } },
    });
    expect(solo.scope).toBe('solo');
    await expect(page.locator('#playback-notice')).toHaveAttribute('data-kind', 'solo');

    // Human presses Ctrl+Enter: the native mirror.evaluate() on the visible document,
    // with no adapter involvement — the whole document is sounding again, so the notice goes.
    await page.evaluate(() => {
      const host = document.querySelector('strudel-editor') as unknown as { editor: { evaluate(): Promise<void> } };
      return host.editor.evaluate();
    });
    await expect(page.locator('#playback-notice')).toBeHidden();
    await expect.poll(async () => (await replState(page)).activeCode).toBe(doc);
    const after = await callTool<ContextResult>(page, 'strudel_get_context');
    expect(after.agent.solo).toBeUndefined();
  });

  test('stopping playback ends an agent take and keeps the clip', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);

    const recording = callTool<RecordResult>(page, 'strudel_record', { untilStopped: true, label: 'stopped take' });
    await expect(page.locator('#btn-rec')).toHaveAttribute('data-recording', 'true');
    await page.waitForTimeout(1200);
    // Human presses Play again to stop (native toggle) — either side can end anyone's take.
    await page.locator('#btn-play').click();
    const rec = await recording;
    expect(rec.recorded).toBe(true);
    expect(rec.label).toBe('stopped take');
    await expect(page.locator('#recordings .clip')).toHaveCount(1);
    await expect(page.locator('#btn-rec')).toHaveAttribute('data-recording', 'false');
  });
});

test.describe('strudel_record', () => {
  test('untilStopped waits for the human and returns analysis plus base64 audio', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);

    const recording = callTool<RecordResult>(page, 'strudel_record', { untilStopped: true, label: 'until stop', includeAudio: true });
    await expect(page.locator('#btn-rec')).toHaveAttribute('data-recording', 'true');
    await page.waitForTimeout(1200);
    await page.locator('#btn-rec').click();
    const rec = await recording;

    expect(rec.recorded).toBe(true);
    expect(rec.label).toBe('until stop');
    expect(rec.source).toBe('master');
    expect(rec.durationMs).toBeGreaterThanOrEqual(900);
    expect(rec.mimeType).toMatch(/^audio\//);
    expect(rec.sampleRate).toBeGreaterThan(0);
    expect(rec.channels).toBeGreaterThan(0);
    expect(rec.silent).toBe(false);
    expect(Number.isFinite(rec.peakDbfs)).toBe(true);
    expect(rec.peakDbfs).toBeGreaterThan(-60);
    expect(Number.isFinite(rec.rmsDbfs)).toBe(true);
    expect(rec.loudnessDbfs.length).toBeGreaterThan(0);
    for (const band of [rec.bandsDb.low, rec.bandsDb.mid, rec.bandsDb.high]) {
      expect(Number.isFinite(band)).toBe(true);
    }
    expect(typeof rec.audioBase64).toBe('string');
    expect(rec.audioBase64!.length).toBeGreaterThan(0);

    // The take is left in the page for the human — takes are takes, no agent framing.
    await expect(page.locator('#recordings .clip')).toHaveCount(1);
    await expect(page.locator('#recordings .clip .clip-label')).toHaveText('until stop');
    await expect(page.locator('#btn-rec')).toHaveAttribute('data-recording', 'false');
  });

  test('an .analyze(id) source isolates one voice; unknown ids list what is available', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);

    const code = await callTool<{ code: string; codeHash: string }>(page, 'strudel_get_code');
    const kick = lineOf(code.code, 'bd*4');
    const ins = kick.text.indexOf('.gain(');
    const edited = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: code.codeHash,
      edits: [{ range: { start: { line: kick.line, column: ins }, end: { line: kick.line, column: ins } }, text: '.analyze("kick")' }],
      evaluate: true,
    });
    expect(edited.updated).toBe(true);
    await page.waitForTimeout(500);

    const kickRec = await callTool<RecordResult>(page, 'strudel_record', { durationMs: 1000, source: 'kick' });
    expect(kickRec.recorded).toBe(true);
    expect(kickRec.source).toBe('kick');
    expect(kickRec.durationMs).toBeGreaterThanOrEqual(500);
    expect(Number.isFinite(kickRec.peakDbfs)).toBe(true);
    expect(kickRec.bandsDb.low).toBeGreaterThan(kickRec.bandsDb.high);

    const bad = await callTool<ToolError>(page, 'strudel_record', { durationMs: 1000, source: 'nope' });
    expect(bad.error).toBe('INVALID_INPUT');
    expect(bad.available).toContain('kick');
  });

  test('codeHash reflects the code visible when recording started, not a later edit made mid-take', async ({ page }) => {
    await openWithShim(page);
    await pressPlay(page);

    const before = await callTool<{ code: string; codeHash: string }>(page, 'strudel_get_code');
    const recording = callTool<RecordResult>(page, 'strudel_record', { untilStopped: true, label: 'mid-take edit' });
    await expect(page.locator('#btn-rec')).toHaveAttribute('data-recording', 'true');
    await page.waitForTimeout(600);

    // Edit and re-evaluate *while the take is still running* — this is the "concurrent
    // record + edit" case: the recorder is still capturing audio produced by `before.code`.
    const hats = lineOf(before.code, 'hh*8');
    const col = hats.text.indexOf('hh*8');
    const edited = await callTool<EditResult>(page, 'strudel_apply_edits', {
      expectedCodeHash: before.codeHash,
      edits: [{ range: { start: { line: hats.line, column: col }, end: { line: hats.line, column: col + 4 } }, text: 'hh*16' }],
      evaluate: true,
    });
    expect(edited.updated).toBe(true);
    expect(edited.codeHash).not.toBe(before.codeHash);

    await page.waitForTimeout(600);
    await page.locator('#btn-rec').click();
    const rec = await recording;

    expect(rec.recorded).toBe(true);
    // The clip captured `before.code`'s audio, so its codeHash must be the hash from
    // when the take started — not the hash of whatever the document became afterwards.
    expect(rec.codeHash).toBe(before.codeHash);
    expect(rec.codeHash).not.toBe(edited.codeHash);
  });
});

test.describe('sounds, versions and themes', () => {
  test('strudel_load_samples registers a data-URL sample that list_sounds and the page both show', async ({ page }) => {
    await openWithShim(page);

    const wavB64 = await page.evaluate(() => {
      const n = 4800;
      const buf = new ArrayBuffer(44 + n * 2);
      const v = new DataView(buf);
      const w = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
      };
      w(0, 'RIFF');
      v.setUint32(4, 36 + n * 2, true);
      w(8, 'WAVE');
      w(12, 'fmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, 48000, true);
      v.setUint32(28, 96000, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      w(36, 'data');
      v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 8) * 12000, true);
      let b = '';
      new Uint8Array(buf).forEach((x) => (b += String.fromCharCode(x)));
      return btoa(b);
    });

    const loaded = await callTool<{ loaded: string[]; failed: string[] }>(page, 'strudel_load_samples', {
      sources: { beep: `data:audio/wav;base64,${wavB64}` },
    });
    expect(loaded.loaded).toEqual(['beep']);
    expect(loaded.failed).toEqual([]);

    const list = await callTool<{ total: number; sounds: { name: string }[] }>(page, 'strudel_list_sounds', { query: 'beep' });
    expect(list.total).toBeGreaterThanOrEqual(1);
    expect(list.sounds.map((s) => s.name)).toContain('beep');

    await expect(page.locator('#samples .sample-chip')).toHaveCount(1);
    await expect(page.locator('#samples .sample-chip').first()).toHaveText('beep');

    const bad = await callTool<ToolError>(page, 'strudel_load_samples', { sources: 'not a url' });
    expect(bad.error).toBe('INVALID_INPUT');
  });

  test('strudel_snapshot saves a version with a strudel.cc URL', async ({ page }) => {
    await openWithShim(page);

    const ctx = await callTool<ContextResult>(page, 'strudel_get_context');
    const snap = await callTool<{ snapshotId: string; label: string; codeHash: string; strudelUrl: string; lineCount: number }>(
      page,
      'strudel_snapshot',
      { label: 'v1' },
    );
    expect(snap.snapshotId).toMatch(/^snap-/);
    expect(snap.label).toBe('v1');
    expect(snap.codeHash).toBe(ctx.editor.codeHash);
    expect(snap.strudelUrl).toMatch(/^https:\/\/strudel\.cc\/#/);
    expect(snap.lineCount).toBe((await editorDoc(page)).split('\n').length);

    await expect(page.locator('#versions .version')).toHaveCount(1);
  });

  test('strudel_set_theme switches the editor theme and rejects unknown names', async ({ page }) => {
    await openWithShim(page);

    const set = await callTool<{ theme: string; themes: string[] }>(page, 'strudel_set_theme', { theme: 'nord' });
    expect(set.theme).toBe('nord');
    expect(set.themes).toContain('nord');

    expect((await callTool<ContextResult>(page, 'strudel_get_context')).theme).toBe('nord');

    const bad = await callTool<ToolError>(page, 'strudel_set_theme', { theme: 'nope' });
    expect(bad.error).toBe('INVALID_INPUT');
    expect(bad.themes).toContain('nord');
  });
});
