import { describe, expect, it } from 'vitest';
import { StrudelError } from '../../src/webmcp/errors';
import {
  lineCount,
  lineStarts,
  offsetToPosition,
  offsetsToRange,
  positionToOffset,
  rangeToOffsets,
} from '../../src/strudel/selection';

/** Run fn, assert it throws a StrudelError with the given code, and return the error. */
function expectStrudelError(fn: () => unknown, code: string): StrudelError {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(StrudelError);
  expect((caught as StrudelError).code).toBe(code);
  return caught as StrudelError;
}

// "abc" (0-3) \n "de" (4-6) \n "fghi" (7-11), no trailing newline.
const NO_TRAILING = 'abc\nde\nfghi';
// "abc" (0-3) \n "def" (4-8), with a trailing newline, so there's an implicit empty last line.
const TRAILING = 'abc\ndef\n';

describe('lineStarts / lineCount', () => {
  it('computes line starts for a doc without a trailing newline', () => {
    expect(lineStarts(NO_TRAILING)).toEqual([0, 4, 7]);
    expect(lineCount(NO_TRAILING)).toBe(3);
  });

  it('computes line starts for a doc with a trailing newline (implicit empty last line)', () => {
    expect(lineStarts(TRAILING)).toEqual([0, 4, 8]);
    expect(lineCount(TRAILING)).toBe(3);
  });

  it('handles the empty document as a single empty line', () => {
    expect(lineStarts('')).toEqual([0]);
    expect(lineCount('')).toBe(1);
  });
});

describe('offsetToPosition <-> positionToOffset round trips', () => {
  it('round-trips every offset in a doc without a trailing newline', () => {
    for (let offset = 0; offset <= NO_TRAILING.length; offset++) {
      const pos = offsetToPosition(NO_TRAILING, offset);
      expect(positionToOffset(NO_TRAILING, pos)).toBe(offset);
    }
  });

  it('round-trips every offset in a doc with a trailing newline', () => {
    for (let offset = 0; offset <= TRAILING.length; offset++) {
      const pos = offsetToPosition(TRAILING, offset);
      expect(positionToOffset(TRAILING, pos)).toBe(offset);
    }
  });

  it('places the last line correctly when the doc has no trailing newline', () => {
    // offset at end of doc -> last line, column == line length
    const pos = offsetToPosition(NO_TRAILING, NO_TRAILING.length);
    expect(pos).toEqual({ line: 2, column: 4 });
  });

  it('places the implicit empty last line when the doc has a trailing newline', () => {
    const pos = offsetToPosition(TRAILING, TRAILING.length);
    expect(pos).toEqual({ line: 2, column: 0 });
  });

  it('allows column == line length (end of line)', () => {
    // line 0 is "abc", length 3
    expect(positionToOffset(NO_TRAILING, { line: 0, column: 3 })).toBe(3);
  });

  it('rejects column beyond the end of the line with INVALID_RANGE', () => {
    expectStrudelError(() => positionToOffset(NO_TRAILING, { line: 0, column: 4 }), 'INVALID_RANGE');
  });

  it('rejects a line beyond the doc with INVALID_RANGE', () => {
    expectStrudelError(() => positionToOffset(NO_TRAILING, { line: 3, column: 0 }), 'INVALID_RANGE');
  });

  it('rejects non-integer or negative line/column', () => {
    expect(() => positionToOffset(NO_TRAILING, { line: -1, column: 0 })).toThrow(StrudelError);
    expect(() => positionToOffset(NO_TRAILING, { line: 0, column: 1.5 })).toThrow(StrudelError);
  });
});

describe('rangeToOffsets', () => {
  it('converts a valid range to offsets', () => {
    const { from, to } = rangeToOffsets(NO_TRAILING, {
      start: { line: 0, column: 1 },
      end: { line: 1, column: 2 },
    });
    expect(from).toBe(1);
    expect(to).toBe(6);
  });

  it('rejects a range whose end precedes its start', () => {
    expectStrudelError(
      () => rangeToOffsets(NO_TRAILING, { start: { line: 0, column: 2 }, end: { line: 0, column: 1 } }),
      'INVALID_RANGE',
    );
  });

  it('rejects a missing range', () => {
    // @ts-expect-error testing runtime guard against a missing range
    expect(() => rangeToOffsets(NO_TRAILING, undefined)).toThrow(StrudelError);
  });
});

describe('offsetsToRange', () => {
  it('converts offsets back to a line/column range', () => {
    expect(offsetsToRange(NO_TRAILING, 1, 6)).toEqual({
      start: { line: 0, column: 1 },
      end: { line: 1, column: 2 },
    });
  });
});
