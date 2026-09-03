import type { StrudelEditorElement, StrudelMirrorLike } from './host';
import { type MasterTap, recordMaster, resolveAnalyser } from './audio-tap';
import { analyzeAudioBuffer } from './analysis';
import {
  LIMITS,
  type CodeSlice,
  type EditOptions,
  type EditResult,
  type EvaluateOptions,
  type EvaluationResult,
  type FocusResult,
  type LoadSamplesResult,
  type PlaybackResult,
  type ProposalResult,
  type RecordOptions,
  type RecordResult,
  type SnapshotResult,
  type SoundingRange,
  type SourceEdit,
  type SourceRange,
  type StrudelAdapter,
  type StrudelContext,
  type ThemeResult,
} from './types';
import { hashCode } from './revisions';
import { lineStarts, offsetToPosition, rangeToOffsets } from './selection';
import { applyChanges, planEdits, validateReplacement, type OffsetChange } from './editor';
import { StrudelError, aborted, staleCode } from '../webmcp/errors';
import { audioGestureRequired, evaluateVisible, hasUserActivation, isPlaying, readEvalError } from './playback';
import { Session, newId, type Proposal } from './session';
import { listSounds as registryList, loadSamples as registryLoad } from './sounds';
import { strudelCcUrl } from './share';
import { unifiedDiff } from './diff';

/** Distinct, non-joinable CodeMirror user-event tag so each agent mutation is one undo step. */
const AGENT_USER_EVENT = 'input.webmcp';

export interface AdapterOptions {
  /** Master-output tap used by record(); when absent, record() reports RECORDING_UNSUPPORTED. */
  tap?: MasterTap;
  /** Receives every finished clip so the page can show it to the human. */
  onRecording?: (clip: { id: string; label: string; blob: Blob; buffer: AudioBuffer; durationMs: number }) => void;
  session?: Session;
  /** Known editor theme names (from the pinned REPL). */
  themes?: string[];
}

/**
 * The single seam between WebMCP tools (and the page's own buttons) and the live Strudel REPL.
 * Every call reads the visible CodeMirror document; nothing is cached.
 */
export function createStrudelAdapter(host: StrudelEditorElement, options: AdapterOptions = {}): StrudelAdapter & { session: Session } {
  const session = options.session ?? new Session();
  const themes = options.themes ?? [];
  let lastTheme: string | undefined;

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

  const assertAgentMay = (action: 'edit' | 'perform' | 'configure'): void => {
    const mode = session.state.mode;
    if (mode === 'read') {
      throw new StrudelError('MODE_DENIED', `The human has set the agent to read-only mode; ${action} actions are disabled. Ask them to switch the mode to Review or Live in the page header.`, {
        mode,
      });
    }
  };

  const dispatchChanges = (changes: OffsetChange | OffsetChange[]): void => {
    view().dispatch({ changes, userEvent: AGENT_USER_EVENT });
  };

  const editResult = (changes: number): EditResult => {
    const code = read();
    return { updated: true, codeHash: hashCode(code), changes, length: code.length, lineCount: lineStarts(code).length };
  };

  const playbackResult = (): PlaybackResult => ({ playing: isPlaying(mirror()), codeHash: hashCode(read()) });

  const evaluationResult = (m: StrudelMirrorLike, scope: EvaluationResult['scope']): EvaluationResult => {
    const r: EvaluationResult = { ok: true, playing: isPlaying(m), codeHash: hashCode(read()), scope };
    if (scope === 'solo' && session.state.solo) r.solo = session.state.solo.range;
    return r;
  };

  /** Run the native evaluate on a string derived from visible source (solo / audition). */
  const evaluateDerived = async (m: StrudelMirrorLike, code: string, signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) throw aborted();
    if (!isPlaying(m) && !hasUserActivation()) throw audioGestureRequired();
    m.flash();
    const abortPromise = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(aborted()), { once: true });
    });
    await Promise.race([m.repl.evaluate(code), abortPromise]);
    if (signal?.aborted) throw aborted();
    const err = readEvalError(m);
    if (err) throw err;
  };

  const makeProposal = (kind: Proposal['kind'], base: string, changes: OffsetChange[], summary: string | undefined): ProposalResult => {
    const wasAuditioning = session.state.auditioning;
    const code = applyChanges(base, changes);
    const first = changes[0];
    const last = changes[changes.length - 1];
    const lineRange = {
      start: first ? offsetToPosition(base, first.from).line : 0,
      end: last ? offsetToPosition(base, last.to).line : 0,
    };
    const proposal: Proposal = {
      id: newId('proposal'),
      summary: (summary ?? '').trim().slice(0, 140) || (kind === 'replace' ? 'Replace the whole composition' : 'Proposed edit'),
      kind,
      baseCodeHash: hashCode(base),
      changes,
      code,
      lineRange,
      createdAt: Date.now(),
    };
    session.setProposal(proposal);
    if (wasAuditioning && isPlaying(mirror())) {
      // The old proposal's code is what is sounding, but that proposal is gone.
      // Return the audio to the visible document so state and sound agree.
      void evaluateVisible(mirror()).catch(() => undefined);
    }
    return {
      proposed: true,
      proposalId: proposal.id,
      summary: proposal.summary,
      baseCodeHash: proposal.baseCodeHash,
      changes: changes.length,
      lineRange,
      diff: unifiedDiff(base, code, LIMITS.maxDiffChars),
      awaiting: 'human',
    };
  };

  const currentProposal = (id?: string): Proposal => {
    const p = session.state.proposal;
    if (!p) throw new StrudelError('NO_PROPOSAL', 'There is no pending proposal.');
    if (id && p.id !== id) throw new StrudelError('NO_PROPOSAL', `Proposal ${id} is no longer pending; the current one is ${p.id}.`, { currentProposalId: p.id });
    return p;
  };

  const finishEdit = async (evaluate: boolean | undefined, changes: number): Promise<EditResult> => {
    const result = editResult(changes);
    if (evaluate) {
      const m = mirror();
      if (!isPlaying(m) && !hasUserActivation()) throw audioGestureRequired();
      await evaluateVisible(m);
      session.setSolo(undefined);
      session.setAuditioning(false);
      result.evaluation = evaluationResult(m, 'document');
    }
    return result;
  };

  const adapter: StrudelAdapter & { session: Session } = {
    session,

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
      const st = session.state;
      // During a solo the evaluated text keeps the document's offsets, so sounding stays accurate.
      const sounding = playback.playing && (!playback.dirty || st.solo) && !st.auditioning ? soundingRanges(m, code) : undefined;
      const agent: StrudelContext['agent'] = { mode: st.mode, auditioning: st.auditioning };
      if (st.proposal) {
        agent.proposal = {
          id: st.proposal.id,
          summary: st.proposal.summary,
          baseCodeHash: st.proposal.baseCodeHash,
          lineRange: st.proposal.lineRange,
          stale: st.proposal.baseCodeHash !== hashCode(code),
        };
      }
      if (st.solo) agent.solo = st.solo.range;
      if (st.recording) agent.recording = { label: st.recording.label, elapsedMs: Date.now() - st.recording.startedAt };
      const ctx: StrudelContext = {
        playback,
        ...(sounding ? { sounding } : {}),
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
        agent,
      };
      const theme = currentTheme();
      if (theme) ctx.theme = theme;
      return ctx;
    },

    async applyEdits(edits: SourceEdit[], expectedCodeHash: string, opts: EditOptions = {}) {
      assertAgentMay('edit');
      const code = read();
      assertFresh(expectedCodeHash, code);
      const changes = planEdits(code, edits);
      if (session.state.mode === 'review' || opts.propose) {
        return makeProposal('edits', code, changes, opts.summary);
      }
      // One CodeMirror transaction: atomic, visible, and undoable as its own step.
      dispatchChanges(changes);
      return finishEdit(opts.evaluate, changes.length);
    },

    async replaceCode(code: string, expectedCodeHash: string, opts: EditOptions = {}) {
      assertAgentMay('edit');
      const current = read();
      assertFresh(expectedCodeHash, current);
      const next = validateReplacement(code);
      const change = { from: 0, to: current.length, insert: next };
      if (session.state.mode === 'review' || opts.propose) {
        return makeProposal('replace', current, [change], opts.summary);
      }
      dispatchChanges(change);
      return finishEdit(opts.evaluate, 1);
    },

    async evaluate(expectedCodeHash: string, opts: EvaluateOptions = {}, signal?: AbortSignal): Promise<EvaluationResult> {
      assertAgentMay('perform');
      const m = mirror();
      const code = read();
      const codeHash = assertFresh(expectedCodeHash, code);
      if (opts.proposalId) {
        const p = currentProposal(opts.proposalId);
        if (p.baseCodeHash !== codeHash) throw staleCode(p.baseCodeHash, codeHash);
        await evaluateDerived(m, p.code, signal);
        session.setSolo(undefined);
        session.setAuditioning(true);
        return evaluationResult(m, 'audition');
      }
      if (opts.range) {
        return adapter.soloRange(opts.range);
      }
      if (signal?.aborted) throw aborted();
      // Strudel's Update starts the scheduler when stopped; never do that behind autoplay policy.
      if (!isPlaying(m) && !hasUserActivation()) throw audioGestureRequired();
      await evaluateVisible(m, signal);
      session.setSolo(undefined);
      session.setAuditioning(false);
      return evaluationResult(m, 'document');
    },

    async play(expectedCodeHash: string, signal?: AbortSignal): Promise<PlaybackResult> {
      assertAgentMay('perform');
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
        if (err instanceof StrudelError) throw err;
        throw new StrudelError('PLAYBACK_ERROR', err instanceof Error ? err.message : 'Playback failed.');
      }
      session.setSolo(undefined);
      session.setAuditioning(false);
      return playbackResult();
    },

    async stop(): Promise<PlaybackResult> {
      assertAgentMay('perform');
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

    async record(opts: RecordOptions, signal?: AbortSignal): Promise<RecordResult> {
      const m = mirror();
      const tap = options.tap;
      if (!tap) throw new StrudelError('RECORDING_UNSUPPORTED', 'Recording is not available on this page.');
      if (session.state.recording) {
        throw new StrudelError('PLAYBACK_ERROR', 'A recording is already in progress. Wait for it to finish or stop it in the page.');
      }
      const untilStopped = Boolean(opts.untilStopped);
      const ms = untilStopped ? LIMITS.maxUntilStoppedMs : clampDuration(opts.durationMs);
      const label = typeof opts.label === 'string' && opts.label.trim() ? opts.label.trim().slice(0, 60) : `take ${new Date().toLocaleTimeString()}`;
      const source = typeof opts.source === 'string' && opts.source.trim() && opts.source !== 'master' ? opts.source.trim() : 'master';
      if (opts.includeAudio && !untilStopped && ms > LIMITS.maxInlineAudioMs) {
        throw new StrudelError('SOURCE_TOO_LARGE', `includeAudio is limited to clips of ${LIMITS.maxInlineAudioMs / 1000} s or less.`, { limitMs: LIMITS.maxInlineAudioMs });
      }
      if (!isPlaying(m)) throw new StrudelError('NOT_PLAYING', 'Nothing is playing. Start playback first, then record.');
      const sourceNode = source === 'master' ? undefined : resolveAnalyser(source);
      const stopper = new AbortController();
      session.setRecording({ label, startedAt: Date.now(), stop: () => stopper.abort() });
      let rec;
      try {
        rec = await recordMaster(tap, { maxMs: ms, until: stopper.signal, signal, sourceNode });
      } finally {
        session.setRecording(undefined);
      }
      const analysis = analyzeAudioBuffer(rec.buffer);
      const id = newId('clip');
      options.onRecording?.({ id, label, blob: rec.blob, buffer: rec.buffer, durationMs: analysis.durationMs });
      const result: RecordResult = {
        recorded: true,
        clipId: id,
        label,
        mimeType: rec.mimeType,
        bytes: rec.blob.size,
        ...analysis,
        bandsDb: rec.bandsDb,
        codeHash: hashCode(read()),
        source,
      };
      if (opts.includeAudio && analysis.durationMs <= LIMITS.maxInlineAudioMs) {
        result.audioBase64 = await blobToBase64(rec.blob);
      }
      return result;
    },

    async loadSamples(sources, baseUrl): Promise<LoadSamplesResult> {
      assertAgentMay('configure');
      const requested = typeof sources === 'object' && sources && !Array.isArray(sources) ? Object.keys(sources as object) : [];
      const loaded = await registryLoad(sources, baseUrl);
      session.addSamples(loaded.map((name) => ({ name })));
      return { loaded, failed: requested.filter((n) => !loaded.includes(n)) };
    },

    listSounds(query, limit) {
      return registryList(query, limit);
    },

    snapshot(label): SnapshotResult {
      const code = read();
      const codeHash = hashCode(code);
      const name = (label ?? '').trim().slice(0, 60) || `version ${session.state.snapshots.length + 1}`;
      const id = newId('snap');
      const createdAt = Date.now();
      session.addSnapshot({ id, label: name, code, codeHash, createdAt });
      return { snapshotId: id, label: name, codeHash, lineCount: lineStarts(code).length, strudelUrl: strudelCcUrl(code), createdAt: new Date(createdAt).toISOString() };
    },

    setTheme(theme): ThemeResult {
      assertAgentMay('configure');
      if (typeof theme !== 'string' || !themes.includes(theme)) {
        throw new StrudelError('INVALID_INPUT', `Unknown theme "${String(theme)}".`, { themes });
      }
      mirror().updateSettings({ theme });
      lastTheme = theme;
      return { theme, themes };
    },

    // ---- human-side operations -------------------------------------------------------------

    async acceptProposal(): Promise<EditResult> {
      const p = currentProposal();
      const code = read();
      if (hashCode(code) !== p.baseCodeHash) {
        throw new StrudelError('STALE_CODE', 'The document changed after the proposal was made; discard it and ask the agent again.', {
          expectedCodeHash: p.baseCodeHash,
          currentCodeHash: hashCode(code),
        });
      }
      const wasAuditioning = session.state.auditioning;
      dispatchChanges(p.changes);
      session.setProposal(undefined);
      const result = editResult(p.changes.length);
      if (wasAuditioning && isPlaying(mirror())) {
        // The proposal is already what is sounding; make the runtime agree with the document.
        await evaluateVisible(mirror());
        result.evaluation = evaluationResult(mirror(), 'document');
      }
      return result;
    },

    discardProposal(): void {
      const wasAuditioning = session.state.auditioning;
      session.setProposal(undefined);
      if (wasAuditioning && isPlaying(mirror())) void evaluateVisible(mirror()).catch(() => undefined);
    },

    async auditionProposal(): Promise<EvaluationResult> {
      const p = currentProposal();
      const m = mirror();
      if (hashCode(read()) !== p.baseCodeHash) {
        throw new StrudelError('STALE_CODE', 'The document changed after the proposal was made.', { expectedCodeHash: p.baseCodeHash, currentCodeHash: hashCode(read()) });
      }
      await evaluateDerived(m, p.code);
      session.setSolo(undefined);
      session.setAuditioning(true);
      return evaluationResult(m, 'audition');
    },

    async returnFromAudition(): Promise<EvaluationResult> {
      const m = mirror();
      await evaluateVisible(m);
      session.setSolo(undefined);
      session.setAuditioning(false);
      return evaluationResult(m, 'document');
    },

    async soloRange(range: SourceRange): Promise<EvaluationResult> {
      const m = mirror();
      const code = read();
      const { from, to } = rangeToOffsets(code, range);
      if (to <= from) throw new StrudelError('INVALID_RANGE', 'Solo range must not be empty.');
      // Keep the original offsets so Strudel's playback highlighting still lands on the right characters.
      const text = code.slice(from, to).replace(/[\s,]+$/, '');
      const padded = code.slice(0, from).replace(/[^\n]/g, ' ') + text;
      await evaluateDerived(m, padded);
      session.setAuditioning(false);
      session.setSolo({ range: { start: offsetToPosition(code, from), end: offsetToPosition(code, to), fromOffset: from, toOffset: to } });
      return evaluationResult(m, 'solo');
    },

    restoreSnapshot(id: string): EditResult {
      const snap = session.state.snapshots.find((s) => s.id === id);
      if (!snap) throw new StrudelError('INVALID_INPUT', 'Unknown snapshot.');
      const current = read();
      dispatchChanges({ from: 0, to: current.length, insert: snap.code });
      return editResult(1);
    },
  };

  function currentTheme(): string | undefined {
    try {
      // Strudel's own persisted editor settings store (evalScope'd global), then the element's copy.
      const store = (globalThis as { codemirrorSettings?: { get?: () => { theme?: string } } }).codemirrorSettings;
      const fromStore = store?.get?.()?.theme;
      if (typeof fromStore === 'string') return fromStore;
      const settings = (host as unknown as { settings?: { theme?: string } }).settings;
      return typeof settings?.theme === 'string' ? settings.theme : lastTheme;
    } catch {
      return lastTheme;
    }
  }

  return adapter;
}

function clampDuration(n: unknown): number {
  if (n === undefined || n === null) return LIMITS.defaultRecordMs;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new StrudelError('INVALID_INPUT', 'durationMs must be a number of milliseconds.');
  }
  return Math.min(LIMITS.maxRecordMs, Math.max(LIMITS.minRecordMs, Math.round(n)));
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Source ranges of the events sounding right now, from Strudel's own visible-hap tracking. */
function soundingRanges(m: StrudelMirrorLike, code: string): SoundingRange[] | undefined {
  const haps = m.drawer?.visibleHaps;
  if (!haps || typeof m.repl.scheduler.now !== 'function') return undefined;
  let now: number;
  try {
    now = m.repl.scheduler.now();
  } catch {
    return undefined;
  }
  const seen = new Map<string, SoundingRange>();
  for (const hap of haps) {
    if (!hap.isActive?.(now)) continue;
    for (const loc of hap.context?.locations ?? []) {
      const from = Math.max(0, Math.min(code.length, loc.start));
      const to = Math.max(from, Math.min(code.length, loc.end));
      const key = `${from}:${to}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        start: offsetToPosition(code, from),
        end: offsetToPosition(code, to),
        fromOffset: from,
        toOffset: to,
        text: code.slice(from, Math.min(to, from + LIMITS.maxSoundingText)),
      });
      if (seen.size >= LIMITS.maxSounding) break;
    }
    if (seen.size >= LIMITS.maxSounding) break;
  }
  return [...seen.values()].sort((a, b) => a.fromOffset - b.fromOffset);
}

function clampLine(n: unknown, total: number, label: string): number {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new StrudelError('INVALID_RANGE', `${label} must be a non-negative integer.`);
  }
  return Math.min(n, total - 1);
}
