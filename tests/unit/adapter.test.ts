import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmLine, CmText, CmTransactionSpec, EditorViewLike, ReplLike, StrudelEditorElement, StrudelEvalError, StrudelMirrorLike } from '../../src/strudel/host';
import { createStrudelAdapter } from '../../src/strudel/adapter';
import { Session } from '../../src/strudel/session';
import { hashCode } from '../../src/strudel/revisions';
import { StrudelError } from '../../src/webmcp/errors';
import { LIMITS } from '../../src/strudel/types';

function computeLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

/** A fake CodeMirror EditorView backed by a plain mutable string. */
class FakeEditorView implements EditorViewLike {
  text: string;
  selFrom: number;
  selTo: number;
  dom: HTMLElement = {} as HTMLElement;
  hasFocus = false;
  focusCallCount = 0;
  dispatchCalls: CmTransactionSpec[] = [];

  constructor(initialText: string, sel: { from: number; to: number } = { from: 0, to: 0 }) {
    this.text = initialText;
    this.selFrom = sel.from;
    this.selTo = sel.to;
  }

  get state() {
    const text = this.text;
    const starts = computeLineStarts(text);
    const doc: CmText = {
      length: text.length,
      lines: starts.length,
      toString: () => text,
      sliceString: (from: number, to: number) => text.slice(from, to),
      lineAt: (pos: number): CmLine => {
        let line = 0;
        for (let i = starts.length - 1; i >= 0; i--) {
          const s = starts[i] ?? 0;
          if (s <= pos) {
            line = i;
            break;
          }
        }
        const from = starts[line] ?? 0;
        const to = line + 1 < starts.length ? (starts[line + 1] ?? text.length) - 1 : text.length;
        return { from, to, number: line + 1, text: text.slice(from, to) };
      },
    };
    return {
      doc,
      selection: {
        main: {
          from: Math.min(this.selFrom, this.selTo),
          to: Math.max(this.selFrom, this.selTo),
          head: this.selTo,
          anchor: this.selFrom,
          empty: this.selFrom === this.selTo,
        },
      },
      sliceDoc: (from: number, to: number) => text.slice(from, to),
    };
  }

  dispatch(spec: CmTransactionSpec): void {
    this.dispatchCalls.push(spec);
    if (spec.changes) {
      const changes = Array.isArray(spec.changes) ? spec.changes : [spec.changes];
      const sorted = [...changes].sort((a, b) => a.from - b.from);
      let out = '';
      let cursor = 0;
      for (const c of sorted) {
        out += this.text.slice(cursor, c.from) + c.insert;
        cursor = c.to;
      }
      out += this.text.slice(cursor);
      this.text = out;
    }
    if (spec.selection) {
      this.selFrom = spec.selection.anchor;
      this.selTo = spec.selection.head ?? spec.selection.anchor;
    }
  }

  focus(): void {
    this.focusCallCount++;
    this.hasFocus = true;
  }
}

interface FakeReplOptions {
  started?: boolean;
  activeCode?: string;
  evalError?: StrudelEvalError;
}

class FakeRepl implements ReplLike {
  scheduler: { started: boolean; now(): number };
  state: ReplLike['state'];
  stopCallCount = 0;
  evaluateCalls: string[] = [];

  constructor(opts: FakeReplOptions = {}) {
    this.scheduler = { started: opts.started ?? false, now: () => 0 };
    this.state = {
      code: '',
      activeCode: opts.activeCode ?? '',
      evalError: opts.evalError,
      schedulerError: undefined,
      pending: false,
      started: opts.started ?? false,
      isDirty: false,
    };
  }

  stop(): void {
    this.stopCallCount++;
    this.scheduler.started = false;
  }

  async evaluate(code: string): Promise<unknown> {
    this.evaluateCalls.push(code);
    this.state.activeCode = code;
    return undefined;
  }
}

class FakeMirror implements StrudelMirrorLike {
  editor: FakeEditorView;
  repl: FakeRepl;
  evaluateCallCount = 0;
  stopCallCount = 0;
  toggleCallCount = 0;
  flashCallCount = 0;
  themes: string[] = [];
  onEvaluate?: () => void;

  constructor(editor: FakeEditorView, repl: FakeRepl) {
    this.editor = editor;
    this.repl = repl;
  }

  get code(): string {
    return this.editor.text;
  }

  async evaluate(): Promise<void> {
    this.evaluateCallCount++;
    this.onEvaluate?.();
  }

  async stop(): Promise<void> {
    this.stopCallCount++;
    this.repl.stop();
  }

  async toggle(): Promise<void> {
    this.toggleCallCount++;
  }

  flash(): void {
    this.flashCallCount++;
  }

  setTheme(name: string): void {
    this.themes = [name];
  }

  updateSettings(settings: Record<string, unknown>): void {
    if (typeof settings.theme === 'string') this.themes = [settings.theme];
  }
}

function makeHost(text: string, opts: { sel?: { from: number; to: number }; repl?: FakeReplOptions } = {}): {
  host: StrudelEditorElement;
  mirror: FakeMirror;
  editor: FakeEditorView;
  repl: FakeRepl;
} {
  const editor = new FakeEditorView(text, opts.sel);
  const repl = new FakeRepl(opts.repl);
  const mirror = new FakeMirror(editor, repl);
  const host = { editor: mirror } as unknown as StrudelEditorElement;
  return { host, mirror, editor, repl };
}

describe('createStrudelAdapter', () => {
  describe('getContext', () => {
    it('returns cursor/selection/text and a dirty flag; lastEvaluationError present only when set', () => {
      const { host } = makeHost('s("bd sd")', { sel: { from: 2, to: 4 } });
      const adapter = createStrudelAdapter(host);
      const ctx = adapter.getContext();
      expect(ctx.editor.cursor).toEqual({ line: 0, column: 4, offset: 4 });
      expect(ctx.editor.selection).toMatchObject({
        empty: false,
        start: { line: 0, column: 2 },
        end: { line: 0, column: 4 },
        fromOffset: 2,
        toOffset: 4,
        text: '"b',
        textTruncated: false,
      });
      expect(ctx.playback.dirty).toBe(true); // activeCode '' !== code
      expect(ctx.playback.lastEvaluationError).toBeUndefined();
    });

    it('includes lastEvaluationError when the repl has an evalError', () => {
      const { host } = makeHost('s("bd")', { repl: { evalError: Object.assign(new Error('boom'), {}) } });
      const adapter = createStrudelAdapter(host);
      const ctx = adapter.getContext();
      expect(ctx.playback.lastEvaluationError).toBe('boom');
    });

    it('reflects dirty=false when activeCode matches the visible code', () => {
      const { host } = makeHost('s("bd")', { repl: { activeCode: 's("bd")' } });
      const adapter = createStrudelAdapter(host);
      expect(adapter.getContext().playback.dirty).toBe(false);
    });
  });

  describe('getCodeSlice', () => {
    it('returns the full source when no range is given', () => {
      const { host } = makeHost('a\nbb\nccc');
      const adapter = createStrudelAdapter(host);
      const slice = adapter.getCodeSlice();
      expect(slice.code).toBe('a\nbb\nccc');
      expect(slice.startLine).toBe(0);
      expect(slice.endLine).toBe(2);
      expect(slice.lineCount).toBe(3);
      expect(slice.truncated).toBe(false);
    });

    it('returns a line range', () => {
      const { host } = makeHost('a\nbb\nccc');
      const adapter = createStrudelAdapter(host);
      const slice = adapter.getCodeSlice(1, 2);
      expect(slice.code).toBe('bb\nccc');
      expect(slice.startLine).toBe(1);
      expect(slice.endLine).toBe(2);
    });

    it('truncates when the source exceeds LIMITS.maxSourceRead', () => {
      const big = 'x'.repeat(LIMITS.maxSourceRead + 50);
      const { host } = makeHost(big);
      const adapter = createStrudelAdapter(host);
      const slice = adapter.getCodeSlice();
      expect(slice.code.length).toBe(LIMITS.maxSourceRead);
      expect(slice.truncated).toBe(true);
    });
  });

  describe('selection text truncation', () => {
    it('truncates selection text longer than LIMITS.maxSelectionText', () => {
      const big = 'x'.repeat(LIMITS.maxSelectionText + 50);
      const { host } = makeHost(big, { sel: { from: 0, to: big.length } });
      const adapter = createStrudelAdapter(host);
      const ctx = adapter.getContext();
      expect(ctx.editor.selection.text.length).toBe(LIMITS.maxSelectionText);
      expect(ctx.editor.selection.textTruncated).toBe(true);
    });
  });

  describe('applyEdits', () => {
    it('rejects with STALE_CODE on a wrong hash, does not dispatch, and leaves the doc unchanged', async () => {
      const { host, editor } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      const edits = [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } }, text: 'X' }];
      await expect(adapter.applyEdits(edits, 'wrong-hash')).rejects.toThrow(StrudelError);
      await expect(adapter.applyEdits(edits, 'wrong-hash')).rejects.toMatchObject({ code: 'STALE_CODE' });
      expect(editor.dispatchCalls.length).toBe(0);
      expect(editor.text).toBe('abcdef');
    });

    it('dispatches once with an array of changes on a correct hash and returns the new codeHash', async () => {
      const { host, editor } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      const expected = hashCode('abcdef');
      const edits = [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } }, text: 'X' }];
      const result = await adapter.applyEdits(edits, expected);
      expect(editor.dispatchCalls.length).toBe(1);
      expect(Array.isArray(editor.dispatchCalls[0]?.changes)).toBe(true);
      expect(editor.text).toBe('Xbcdef');
      expect(result).toMatchObject({ updated: true, codeHash: hashCode('Xbcdef'), changes: 1 });
    });

    it('rejects a missing expectedCodeHash with INVALID_INPUT', async () => {
      const { host } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      const edits = [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } }, text: 'X' }];
      // @ts-expect-error testing runtime guard against a missing hash
      await expect(adapter.applyEdits(edits, undefined)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
  });

  describe('proposal superseding an audition', () => {
    const insert = [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }, text: '// ' }];

    it('returns the audio to the visible document when playing', async () => {
      const { host, mirror, editor } = makeHost('s("bd")', { repl: { started: true, activeCode: 's("bd")' } });
      const adapter = createStrudelAdapter(host, { session: new Session('review') });
      const base = hashCode('s("bd")');
      const first = await adapter.applyEdits(insert, base);
      expect(first).toMatchObject({ proposed: true });
      const proposalId = (first as { proposalId: string }).proposalId;
      const audition = await adapter.evaluate(base, { proposalId });
      expect(audition.scope).toBe('audition');
      expect(adapter.session.state.auditioning).toBe(true);

      const second = await adapter.applyEdits(insert, base);
      expect(second).toMatchObject({ proposed: true });
      // The old proposal is gone, so its code must stop sounding: the doc is re-evaluated.
      await vi.waitFor(() => expect(mirror.evaluateCallCount).toBe(1));
      expect(adapter.session.state.auditioning).toBe(false);
      expect(editor.text).toBe('s("bd")');
    });

    it('does not evaluate when nothing is playing', async () => {
      const { host, mirror } = makeHost('s("bd")', { repl: { started: false, activeCode: '' } });
      const adapter = createStrudelAdapter(host, { session: new Session('review') });
      const base = hashCode('s("bd")');
      const first = await adapter.applyEdits(insert, base);
      const proposalId = (first as { proposalId: string }).proposalId;
      await adapter.evaluate(base, { proposalId });
      expect(adapter.session.state.auditioning).toBe(true);
      await adapter.applyEdits(insert, base);
      await new Promise((r) => setTimeout(r, 10));
      expect(mirror.evaluateCallCount).toBe(0);
      expect(adapter.session.state.auditioning).toBe(false);
    });
  });

  describe('replaceCode', () => {
    it('rejects with STALE_CODE on a wrong hash', async () => {
      const { host } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      await expect(adapter.replaceCode('new code', 'wrong-hash')).rejects.toMatchObject({ code: 'STALE_CODE' });
    });

    it('replaces the whole document on a correct hash', async () => {
      const { host, editor } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      const result = await adapter.replaceCode('new code', hashCode('abcdef'));
      expect(editor.text).toBe('new code');
      expect(result).toMatchObject({ updated: true, codeHash: hashCode('new code'), changes: 1 });
    });
  });

  describe('evaluate', () => {
    it('throws STALE_CODE and does not call evaluate() when the hash is stale', async () => {
      const { host, mirror } = makeHost('abcdef', { repl: { started: true } });
      const adapter = createStrudelAdapter(host);
      await expect(adapter.evaluate('wrong-hash')).rejects.toMatchObject({ code: 'STALE_CODE' });
      expect(mirror.evaluateCallCount).toBe(0);
    });

    it('throws EVALUATION_ERROR with the message and a zero-based line number', async () => {
      const evalError = Object.assign(new Error('syntax error'), { loc: { line: 3, column: 5 } });
      const { host, mirror } = makeHost('abcdef', { repl: { started: true, evalError: undefined } });
      // Configure evaluate() to populate evalError as the real repl would.
      mirror.onEvaluate = () => {
        mirror.repl.state.evalError = evalError;
      };
      const adapter = createStrudelAdapter(host);
      const expected = hashCode('abcdef');
      await expect(adapter.evaluate(expected)).rejects.toMatchObject({
        code: 'EVALUATION_ERROR',
        message: 'syntax error',
        details: { line: 2, column: 5 },
      });
    });

    it('throws ABORTED and does not call evaluate() when the signal is already aborted', async () => {
      const { host, mirror } = makeHost('abcdef', { repl: { started: true } });
      const adapter = createStrudelAdapter(host);
      const controller = new AbortController();
      controller.abort();
      await expect(adapter.evaluate(hashCode('abcdef'), {}, controller.signal)).rejects.toMatchObject({
        code: 'ABORTED',
      });
      expect(mirror.evaluateCallCount).toBe(0);
    });

    describe('AUDIO_GESTURE_REQUIRED', () => {
      let originalNavigatorDescriptor: PropertyDescriptor | undefined;

      beforeEach(() => {
        originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
      });

      afterEach(() => {
        if (originalNavigatorDescriptor) {
          Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
        }
      });

      it('throws AUDIO_GESTURE_REQUIRED when stopped and no user activation has occurred', async () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: { userActivation: { hasBeenActive: false } },
          configurable: true,
        });
        const { host, mirror } = makeHost('abcdef', { repl: { started: false } });
        const adapter = createStrudelAdapter(host);
        await expect(adapter.evaluate(hashCode('abcdef'))).rejects.toMatchObject({
          code: 'AUDIO_GESTURE_REQUIRED',
        });
        expect(mirror.evaluateCallCount).toBe(0);
      });
    });
  });

  describe('play', () => {
    it('returns {playing: true} without evaluating when already playing', async () => {
      const { host, mirror } = makeHost('abcdef', { repl: { started: true } });
      const adapter = createStrudelAdapter(host);
      const result = await adapter.play(hashCode('abcdef'));
      expect(result.playing).toBe(true);
      expect(mirror.evaluateCallCount).toBe(0);
    });
  });

  describe('stop', () => {
    it('calls mirror.stop()', async () => {
      const { host, mirror } = makeHost('abcdef', { repl: { started: true } });
      const adapter = createStrudelAdapter(host);
      await adapter.stop();
      expect(mirror.stopCallCount).toBe(1);
    });
  });

  describe('focusRange', () => {
    it('dispatches a selection with scrollIntoView and calls focus()', () => {
      const { host, editor } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      const result = adapter.focusRange({ start: { line: 0, column: 1 }, end: { line: 0, column: 3 } });
      const selDispatch = editor.dispatchCalls.find((c) => c.selection);
      expect(selDispatch).toMatchObject({ selection: { anchor: 1, head: 3 }, scrollIntoView: true });
      expect(editor.focusCallCount).toBe(1);
      expect(result.range).toMatchObject({ fromOffset: 1, toOffset: 3 });
    });

    it('throws STALE_CODE with a wrong expectedCodeHash', () => {
      const { host } = makeHost('abcdef');
      const adapter = createStrudelAdapter(host);
      try {
        adapter.focusRange({ start: { line: 0, column: 1 }, end: { line: 0, column: 3 } }, 'wrong-hash');
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as StrudelError).code).toBe('STALE_CODE');
      }
    });
  });

  describe('when the host has no editor', () => {
    it('throws REPL_NOT_READY', () => {
      const host = { editor: null } as unknown as StrudelEditorElement;
      const adapter = createStrudelAdapter(host);
      try {
        adapter.getCode();
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as StrudelError).code).toBe('REPL_NOT_READY');
      }
    });
  });
});
