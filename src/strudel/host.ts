/**
 * Minimal typings for the parts of the pinned @strudel/repl 1.2.0 web component this app touches.
 * Verified against node_modules/@strudel/repl/dist (see docs/research/strudel-repl.md).
 * These are internal upstream objects; keep every access inside src/strudel/.
 */
export interface CmLine {
  from: number;
  to: number;
  number: number;
  text: string;
}
export interface CmText {
  length: number;
  lines: number;
  toString(): string;
  sliceString(from: number, to: number): string;
  lineAt(pos: number): CmLine;
}
export interface CmSelectionRange {
  from: number;
  to: number;
  head: number;
  anchor: number;
  empty: boolean;
}
export interface CmState {
  doc: CmText;
  selection: { main: CmSelectionRange };
  sliceDoc(from: number, to: number): string;
}
export interface CmTransactionSpec {
  changes?: { from: number; to: number; insert: string } | { from: number; to: number; insert: string }[];
  selection?: { anchor: number; head?: number };
  scrollIntoView?: boolean;
  /** CodeMirror user-event tag; a non-joinable tag gives the transaction its own undo group. */
  userEvent?: string;
}
export interface EditorViewLike {
  state: CmState;
  dispatch(spec: CmTransactionSpec): void;
  focus(): void;
  hasFocus: boolean;
  dom: HTMLElement;
}
export interface StrudelEvalError extends Error {
  loc?: { line: number; column: number };
}
export interface ReplState {
  code: string;
  activeCode: string;
  evalError?: StrudelEvalError;
  schedulerError?: Error;
  pending: boolean;
  started: boolean;
  isDirty?: boolean;
}
export interface HapLike {
  isActive?(cycle: number): boolean;
  context?: { locations?: { start: number; end: number }[] };
}
export interface DrawerLike {
  visibleHaps?: HapLike[];
}
export interface ReplLike {
  scheduler: { started: boolean; now(): number };
  state: ReplState;
  stop(): void;
  /** Native evaluation of a code string (used for solo/audition of visible sub-ranges/proposals). */
  evaluate(code: string, autostart?: boolean, hush?: boolean): Promise<unknown>;
}
export interface StrudelMirrorLike {
  editor: EditorViewLike;
  repl: ReplLike;
  drawer?: DrawerLike;
  code: string;
  evaluate(): Promise<void>;
  stop(): Promise<void>;
  toggle(): Promise<void>;
  flash(): void;
  setTheme(name: string): void;
  updateSettings(settings: Record<string, unknown>): void;
}
export interface StrudelEditorElement extends HTMLElement {
  editor: StrudelMirrorLike | null;
}
