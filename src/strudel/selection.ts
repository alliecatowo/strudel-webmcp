import type { SourcePosition, SourceRange } from './types';
import { StrudelError } from '../webmcp/errors';

/** Line-start offsets for a document; line i starts at starts[i]. */
export function lineStarts(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

export function lineCount(code: string): number {
  return lineStarts(code).length;
}

export function offsetToPosition(code: string, offset: number): SourcePosition {
  const starts = lineStarts(code);
  const clamped = Math.max(0, Math.min(offset, code.length));
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= clamped) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, column: clamped - (starts[lo] ?? 0) };
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** Convert a zero-based line/column to an offset, validating against the document. */
export function positionToOffset(code: string, pos: SourcePosition, label = 'position'): number {
  if (!pos || !isInt(pos.line) || !isInt(pos.column)) {
    throw new StrudelError('INVALID_RANGE', `${label} must have non-negative integer line and column.`);
  }
  const starts = lineStarts(code);
  if (pos.line >= starts.length) {
    throw new StrudelError('INVALID_RANGE', `${label} line ${pos.line} is beyond the last line (${starts.length - 1}).`, {
      lineCount: starts.length,
    });
  }
  const lineStart = starts[pos.line] ?? 0;
  const lineEnd = pos.line + 1 < starts.length ? (starts[pos.line + 1] ?? code.length) - 1 : code.length;
  const lineLength = lineEnd - lineStart;
  if (pos.column > lineLength) {
    throw new StrudelError('INVALID_RANGE', `${label} column ${pos.column} is beyond the end of line ${pos.line} (length ${lineLength}).`, {
      lineLength,
    });
  }
  return lineStart + pos.column;
}

export function rangeToOffsets(code: string, range: SourceRange, label = 'range'): { from: number; to: number } {
  if (!range || typeof range !== 'object') {
    throw new StrudelError('INVALID_RANGE', `${label} is required.`);
  }
  const from = positionToOffset(code, range.start, `${label}.start`);
  const to = positionToOffset(code, range.end, `${label}.end`);
  if (to < from) {
    throw new StrudelError('INVALID_RANGE', `${label}.end must not precede ${label}.start.`);
  }
  return { from, to };
}

export function offsetsToRange(code: string, from: number, to: number): SourceRange {
  return { start: offsetToPosition(code, from), end: offsetToPosition(code, to) };
}
