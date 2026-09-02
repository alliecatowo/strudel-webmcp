import type { StrudelEditorElement, StrudelMirrorLike } from './host';
import {
  LIMITS,
  type CodeSlice,
  type EditResult,
  type EvaluationResult,
  type FocusResult,
  type PlaybackResult,
  type SourceEdit,
  type SourceRange,
  type StrudelAdapter,
  type StrudelContext,
} from './types';
import { hashCode } from './revisions';
import { lineStarts, offsetToPosition, rangeToOffsets } from './selection';
import { planEdits, validateReplacement } from './editor';
import { StrudelError, aborted, staleCode } from '../webmcp/errors';
import { audioGestureRequired, evaluateVisible, hasUserActivation, isPlaying } from './playback';

/** Distinct, non-joinable CodeMirror user-event tag so each agent mutation is one undo step. */
const AGENT_USER_EVENT = 'input.webmcp';

/**
 * The single seam between WebMCP tools and the live Strudel REPL.
 * Every call reads the visible CodeMirror document; nothing is cached.
 */
export function createStrudelAdapter(host: StrudelEditorElement): StrudelAdapter {
  const mirror = (): StrudelMirrorLike => {
    const m = host.editor;
    if (!m) throw new StrudelError('REPL_NOT_READY', 'The Strudel REPL has not initialized yet.');
    if (!m.editor?.state) throw new StrudelError('EDITOR_NOT_READY', 'The Strudel editor has not initialized yet.');
    return m;
  };
  const view = () => mirror().editor;
  const read = () => view().state.doc.toString();

  const assertFresh = (expected: unknown, code: string): string => {
    if (typeof expected !== 'string' || expected.length === 0) {
      throw new StrudelError('INVALID_INPUT', 'expectedCodeHash is required; read the code first.');
    }
    const current = hashCode(code);
    if (current !== expected) throw staleCode(expected, current);
    return current;
  };

  const editResult = (changes: number): EditResult => {
    const code = read();
    return { updated: true, codeHash: hashCode(code), changes, length: code.length, lineCount: lineStarts(code).length };
  };

  const playbackResult = (): PlaybackResult => ({ playing: isPlaying(mirror()), codeHash: hashCode(read()) });

  return {
    getCode: read,

    getCodeSlice(startLine, endLine): CodeSlice {
      const code = read();
      const starts = lineStarts(code);
      const total = starts.length;
      const s = clampLine(startLine ?? 0, total, 'startLine');
      const e = clampLine(endLine ?? total - 1, total, 'endLine');
      if (e < s) throw new StrudelError('INVALID_RANGE', 'endLine must not precede startLine.');
      const from = starts[s] ?? 0;
      const to = e + 1 < total ? (starts[e + 1] ?? code.length) - 1 : code.length;
      let slice = code.slice(from, to);
      let truncated = false;
      if (slice.length > LIMITS.maxSourceRead) {
        slice = slice.slice(0, LIMITS.maxSourceRead);
        truncated = true;
      }
      return { code: slice, codeHash: hashCode(code), lineCount: total, startLine: s, endLine: e, truncated };
    },

    getContext(): StrudelContext {
      const m = mirror();
      const state = m.editor.state;
      const code = state.doc.toString();
      const sel = state.selection.main;
      let text = state.sliceDoc(sel.from, sel.to);
      let textTruncated = false;
      if (text.length > LIMITS.maxSelectionText) {
        text = text.slice(0, LIMITS.maxSelectionText);
        textTruncated = true;
      }
      const playback: StrudelContext['playback'] = {
        playing: isPlaying(m),
        dirty: m.repl.state.activeCode !== code,
      };
      const evalError = m.repl.state.evalError;
      if (evalError?.message) playback.lastEvaluationError = evalError.message.slice(0, LIMITS.maxDiagnostic);
      return {
        playback,
        editor: {
          codeHash: hashCode(code),
          length: code.length,
          lineCount: lineStarts(code).length,
          cursor: { ...offsetToPosition(code, sel.head), offset: sel.head },
          selection: {
            empty: sel.empty,
            start: offsetToPosition(code, sel.from),
            end: offsetToPosition(code, sel.to),
            fromOffset: sel.from,
            toOffset: sel.to,
            text,
            textTruncated,
          },
        },
      };
    },

    applyEdits(edits: SourceEdit[], expectedCodeHash: string): EditResult {
      const code = read();
      assertFresh(expectedCodeHash, code);
      const changes = planEdits(code, edits);
      // One CodeMirror transaction: atomic, visible, and undoable as its own step (Ctrl+Z reverts
      // just this agent edit, not the human's earlier work).
      view().dispatch({ changes, userEvent: AGENT_USER_EVENT });
      return editResult(changes.length);
    },

    replaceCode(code: string, expectedCodeHash: string): EditResult {
      const current = read();
      assertFresh(expectedCodeHash, current);
      const next = validateReplacement(code);
      view().dispatch({ changes: { from: 0, to: current.length, insert: next }, userEvent: AGENT_USER_EVENT });
      return editResult(1);
    },

    async evaluate(expectedCodeHash: string, signal?: AbortSignal): Promise<EvaluationResult> {
      const m = mirror();
      const code = read();
      const codeHash = assertFresh(expectedCodeHash, code);
      if (signal?.aborted) throw aborted();
      // Strudel's Update starts the scheduler when stopped; never do that behind autoplay policy.
      if (!isPlaying(m) && !hasUserActivation()) throw audioGestureRequired();
      await evaluateVisible(m, signal);
      return { ok: true, playing: isPlaying(m), codeHash };
    },

    async play(expectedCodeHash: string, signal?: AbortSignal): Promise<PlaybackResult> {
      const m = mirror();
      const code = read();
      assertFresh(expectedCodeHash, code);
      if (signal?.aborted) throw aborted();
      if (isPlaying(m)) return playbackResult();
      if (!hasUserActivation()) throw audioGestureRequired();
      // Native play path: Strudel's play button evaluates the visible code, which starts the scheduler.
      try {
        await evaluateVisible(m, signal);
      } catch (err) {
        if (err instanceof StrudelError && err.code === 'EVALUATION_ERROR') throw err;
        if (err instanceof StrudelError) throw err;
        throw new StrudelError('PLAYBACK_ERROR', err instanceof Error ? err.message : 'Playback failed.');
      }
      return playbackResult();
    },

    async stop(): Promise<PlaybackResult> {
      const m = mirror();
      try {
        await m.stop();
      } catch (err) {
        throw new StrudelError('PLAYBACK_ERROR', err instanceof Error ? err.message : 'Stop failed.');
      }
      return playbackResult();
    },

    focusRange(range: SourceRange, expectedCodeHash?: string): FocusResult {
      const code = read();
      if (expectedCodeHash !== undefined) assertFresh(expectedCodeHash, code);
      const { from, to } = rangeToOffsets(code, range);
      const v = view();
      v.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
      v.focus();
      return {
        focused: true,
        codeHash: hashCode(code),
        range: { start: offsetToPosition(code, from), end: offsetToPosition(code, to), fromOffset: from, toOffset: to },
      };
    },
  };
}

function clampLine(n: unknown, total: number, label: string): number {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new StrudelError('INVALID_RANGE', `${label} must be a non-negative integer.`);
  }
  return Math.min(n, total - 1);
}
