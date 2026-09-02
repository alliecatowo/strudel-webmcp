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
}

export interface EvaluationResult {
  ok: true;
  playing: boolean;
  codeHash: string;
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
  applyEdits(edits: SourceEdit[], expectedCodeHash: string): EditResult;
  replaceCode(code: string, expectedCodeHash: string): EditResult;
  evaluate(expectedCodeHash: string, signal?: AbortSignal): Promise<EvaluationResult>;
  play(expectedCodeHash: string, signal?: AbortSignal): Promise<PlaybackResult>;
  stop(): Promise<PlaybackResult>;
  focusRange(range: SourceRange, expectedCodeHash?: string): FocusResult;
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
} as const;
