/** Zero-based line/column position in the visible CodeMirror document. */
export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export interface SourceEdit {
  range: SourceRange;
  text: string;
}

export interface OffsetRange {
  fromOffset: number;
  toOffset: number;
}

export interface SelectionInfo extends SourceRange, OffsetRange {
  empty: boolean;
  text: string;
  textTruncated: boolean;
}

export interface CursorInfo extends SourcePosition {
  offset: number;
}

export interface StrudelContext {
  playback: {
    playing: boolean;
    /** True when the visible source differs from the code that was last evaluated. */
    dirty: boolean;
    /** Message of the most recent evaluation error, if the last evaluation failed. */
    lastEvaluationError?: string;
  };
  editor: {
    codeHash: string;
    length: number;
    lineCount: number;
    cursor: CursorInfo;
    selection: SelectionInfo;
  };
  /**
   * Source ranges whose events are sounding at this instant (Strudel's own active-hap tracking).
   * Present only while playing and while the evaluated code matches the visible source.
   */
  sounding?: SoundingRange[];
  agent: {
    /** The human's permission dial: read | review | live. */
    mode: 'read' | 'review' | 'live';
    /** Pending proposal awaiting the human, if any. */
    proposal?: { id: string; summary: string; baseCodeHash: string; lineRange: { start: number; end: number }; stale: boolean };
    /** True while the proposal (not the document) is what is sounding. */
    auditioning: boolean;
    /** Present while a range is soloed. */
    solo?: SourceRange & OffsetRange;
    /** Present while a recording is in progress. */
    recording?: { label: string; elapsedMs: number };
  };
  theme?: string;
}

export interface SoundingRange extends SourceRange, OffsetRange {
  text: string;
}

export interface RecordResult {
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
  windowMs: number;
  loudnessDbfs: number[];
  /** Approximate average magnitude per band during the clip (dB): low <250 Hz, mid 250–2500 Hz, high >2500 Hz. */
  bandsDb: { low: number; mid: number; high: number };
  codeHash: string;
  source: string;
  /** Present when includeAudio was requested. */
  audioBase64?: string;
}

export interface CodeSlice {
  code: string;
  codeHash: string;
  lineCount: number;
  startLine: number;
  endLine: number;
  truncated: boolean;
}

export interface EditResult {
  updated: true;
  codeHash: string;
  changes: number;
  length: number;
  lineCount: number;
  /** Present when the edit was also evaluated (evaluate: true). */
  evaluation?: EvaluationResult;
}

/** Returned instead of EditResult when the human's mode (or the agent's request) routes an edit to review. */
export interface ProposalResult {
  proposed: true;
  proposalId: string;
  summary: string;
  baseCodeHash: string;
  changes: number;
  lineRange: { start: number; end: number };
  /** Bounded unified-style diff of the proposal for the agent's own reference. */
  diff: string;
  /** What happens next: the human must accept in the page; the agent may audition it. */
  awaiting: 'human';
}

export interface EditOptions {
  /** Force review even in live mode. */
  propose?: boolean;
  /** Evaluate immediately after applying (live mode only; ignored for proposals). */
  evaluate?: boolean;
  /** One-line summary shown to the human when a proposal is created. */
  summary?: string;
}

export interface EvaluateOptions {
  /** Evaluate only this range of the visible source (solo). Cleared by the next full evaluate. */
  range?: SourceRange;
  /** Audition a pending proposal's code without changing the document. */
  proposalId?: string;
}

export interface RecordOptions {
  durationMs?: number;
  /** Keep recording until the human presses stop (max 5 min). */
  untilStopped?: boolean;
  /** 'master' (default) or the id used in `.analyze("id")` to record one voice. */
  source?: string;
  /** Return the clip itself as base64 (webm/opus); only for clips up to 20 s. */
  includeAudio?: boolean;
  label?: string;
}

export interface SnapshotResult {
  snapshotId: string;
  label: string;
  codeHash: string;
  lineCount: number;
  /** Open this exact code in the upstream strudel.cc REPL. */
  strudelUrl: string;
  createdAt: string;
}

export interface ThemeResult {
  theme: string;
  themes: string[];
}

export interface LoadSamplesResult {
  loaded: string[];
  /** Names that were requested but did not register (bad URL, CORS, decode failure). */
  failed: string[];
}

export interface EvaluationResult {
  ok: true;
  playing: boolean;
  codeHash: string;
  /** 'document' | 'solo' | 'audition': what is sounding after this call. */
  scope: 'document' | 'solo' | 'audition';
  solo?: SourceRange & OffsetRange;
}

export interface PlaybackResult {
  playing: boolean;
  codeHash: string;
}

export interface FocusResult {
  focused: true;
  codeHash: string;
  range: SourceRange & OffsetRange;
}

export type StrudelErrorCode =
  | 'WEBMCP_UNAVAILABLE'
  | 'REPL_NOT_READY'
  | 'EDITOR_NOT_READY'
  | 'STALE_CODE'
  | 'INVALID_RANGE'
  | 'INVALID_INPUT'
  | 'OVERLAPPING_EDITS'
  | 'SOURCE_TOO_LARGE'
  | 'EVALUATION_ERROR'
  | 'AUDIO_GESTURE_REQUIRED'
  | 'PLAYBACK_ERROR'
  | 'NOT_PLAYING'
  | 'RECORDING_UNSUPPORTED'
  | 'MODE_DENIED'
  | 'NO_PROPOSAL'
  | 'ABORTED'
  | 'INTERNAL_ERROR';

export interface StrudelErrorPayload {
  error: StrudelErrorCode;
  message: string;
  [detail: string]: unknown;
}

/** The narrow adapter WebMCP tools depend on. No CodeMirror internals leak past it. */
export interface StrudelAdapter {
  getCode(): string;
  getCodeSlice(startLine?: number, endLine?: number): CodeSlice;
  getContext(): StrudelContext;
  applyEdits(edits: SourceEdit[], expectedCodeHash: string, options?: EditOptions): Promise<EditResult | ProposalResult>;
  replaceCode(code: string, expectedCodeHash: string, options?: EditOptions): Promise<EditResult | ProposalResult>;
  evaluate(expectedCodeHash: string, options?: EvaluateOptions, signal?: AbortSignal): Promise<EvaluationResult>;
  play(expectedCodeHash: string, signal?: AbortSignal): Promise<PlaybackResult>;
  stop(): Promise<PlaybackResult>;
  focusRange(range: SourceRange, expectedCodeHash?: string): FocusResult;
  record(options: RecordOptions, signal?: AbortSignal): Promise<RecordResult>;
  loadSamples(sources: unknown, baseUrl?: string): Promise<LoadSamplesResult>;
  listSounds(query?: string, limit?: number): { total: number; sounds: { name: string; type: string; tag?: string; variants?: number }[]; truncated: boolean };
  snapshot(label?: string): SnapshotResult;
  setTheme(theme: string): ThemeResult;

  // Human-side operations (page UI). Never exposed as tools.
  acceptProposal(): Promise<EditResult>;
  discardProposal(): void;
  auditionProposal(): Promise<EvaluationResult>;
  returnFromAudition(): Promise<EvaluationResult>;
  soloRange(range: SourceRange): Promise<EvaluationResult>;
  restoreSnapshot(id: string): EditResult;
}

/** Bounds shared by the adapter and the tools. */
export const LIMITS = {
  /** Max characters of full source returned by a read (100 KB). */
  maxSourceRead: 100_000,
  /** Max characters of selected text returned in context (20 KB). */
  maxSelectionText: 20_000,
  /** Max total characters inserted by a single mutation (100 KB). */
  maxMutation: 100_000,
  /** Max characters of an evaluation diagnostic message. */
  maxDiagnostic: 500,
  /** Recording duration bounds (ms) and default. */
  minRecordMs: 500,
  maxRecordMs: 30_000,
  maxUntilStoppedMs: 300_000,
  defaultRecordMs: 4_000,
  /** Longest clip returned inline as base64 audio. */
  maxInlineAudioMs: 20_000,
  /** Max characters in a proposal diff returned to the agent. */
  maxDiffChars: 8_000,
  /** Max "sounding" ranges reported in context and max characters per range. */
  maxSounding: 32,
  maxSoundingText: 120,
} as const;
