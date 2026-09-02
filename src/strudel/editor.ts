import { LIMITS, type SourceEdit } from './types';
import { StrudelError } from '../webmcp/errors';
import { rangeToOffsets } from './selection';

export interface OffsetChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * Validate agent edits against the current source and convert them to offset changes.
 * All-or-nothing: any invalid edit rejects the whole batch. Pure; no editor access.
 */
export function planEdits(code: string, edits: unknown): OffsetChange[] {
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new StrudelError('INVALID_INPUT', 'edits must be a non-empty array.');
  }
  let inserted = 0;
  const changes: OffsetChange[] = edits.map((edit: unknown, i: number) => {
    const e = edit as Partial<SourceEdit>;
    if (!e || typeof e !== 'object' || typeof e.text !== 'string') {
      throw new StrudelError('INVALID_INPUT', `edits[${i}] must have a string text and a range.`);
    }
    const { from, to } = rangeToOffsets(code, e.range as SourceEdit['range'], `edits[${i}].range`);
    inserted += e.text.length;
    return { from, to, insert: e.text };
  });
  if (inserted > LIMITS.maxMutation) {
    throw new StrudelError('SOURCE_TOO_LARGE', `Edits insert ${inserted} characters; the limit is ${LIMITS.maxMutation}.`, {
      limit: LIMITS.maxMutation,
    });
  }
  const sorted = [...changes].sort((a, b) => a.from - b.from || a.to - b.to);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const overlaps = cur.from < prev.to;
    const sameInsertionPoint = prev.from === prev.to && cur.from === cur.to && prev.from === cur.from;
    if (overlaps || sameInsertionPoint) {
      throw new StrudelError('OVERLAPPING_EDITS', 'Edits must not overlap. Merge them or apply them in separate calls.', {
        first: { fromOffset: prev.from, toOffset: prev.to },
        second: { fromOffset: cur.from, toOffset: cur.to },
      });
    }
  }
  return sorted;
}

/** Apply offset changes to a string (used by tests and to compute the resulting document). */
export function applyChanges(code: string, changes: OffsetChange[]): string {
  let out = '';
  let cursor = 0;
  for (const c of changes) {
    out += code.slice(cursor, c.from) + c.insert;
    cursor = c.to;
  }
  return out + code.slice(cursor);
}

export function validateReplacement(code: unknown): string {
  if (typeof code !== 'string') {
    throw new StrudelError('INVALID_INPUT', 'code must be a string.');
  }
  if (code.length > LIMITS.maxMutation) {
    throw new StrudelError('SOURCE_TOO_LARGE', `code is ${code.length} characters; the limit is ${LIMITS.maxMutation}.`, {
      limit: LIMITS.maxMutation,
    });
  }
  return code;
}
