import { describe, expect, it } from 'vitest';
import { StrudelError } from '../../src/webmcp/errors';
import { applyChanges, planEdits, validateReplacement } from '../../src/strudel/editor';
import { LIMITS, type SourceEdit } from '../../src/strudel/types';

function expectStrudelError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(StrudelError);
  expect((caught as StrudelError).code).toBe(code);
}

// "abcdef" line 0, three characters per test range boundary for simplicity.
const CODE = 'abcdef';

function edit(startCol: number, endCol: number, text: string): SourceEdit {
  return {
    range: { start: { line: 0, column: startCol }, end: { line: 0, column: endCol } },
    text,
  };
}

describe('planEdits', () => {
  it('accepts a single valid edit', () => {
    const changes = planEdits(CODE, [edit(1, 3, 'X')]);
    expect(changes).toEqual([{ from: 1, to: 3, insert: 'X' }]);
    expect(applyChanges(CODE, changes)).toBe('aXdef');
  });

  it('sorts multiple non-overlapping edits given out of order and applies them correctly', () => {
    const changes = planEdits(CODE, [edit(4, 5, 'Y'), edit(0, 1, 'X')]);
    expect(changes).toEqual([
      { from: 0, to: 1, insert: 'X' },
      { from: 4, to: 5, insert: 'Y' },
    ]);
    expect(applyChanges(CODE, changes)).toBe('XbcdYf');
  });

  it('rejects overlapping edits with OVERLAPPING_EDITS', () => {
    expectStrudelError(() => planEdits(CODE, [edit(0, 3, 'X'), edit(2, 4, 'Y')]), 'OVERLAPPING_EDITS');
  });

  it('rejects two insertions at the same offset', () => {
    expectStrudelError(() => planEdits(CODE, [edit(2, 2, 'X'), edit(2, 2, 'Y')]), 'OVERLAPPING_EDITS');
  });

  it('accepts adjacent non-overlapping edits (prev.to === cur.from with a non-empty deletion)', () => {
    const changes = planEdits(CODE, [edit(0, 2, 'X'), edit(2, 4, 'Y')]);
    expect(changes).toEqual([
      { from: 0, to: 2, insert: 'X' },
      { from: 2, to: 4, insert: 'Y' },
    ]);
    expect(applyChanges(CODE, changes)).toBe('XYef');
  });

  it('rejects an invalid range with INVALID_RANGE', () => {
    expectStrudelError(() => planEdits(CODE, [edit(0, 100, 'X')]), 'INVALID_RANGE');
  });

  it('rejects a non-array input with INVALID_INPUT', () => {
    expectStrudelError(() => planEdits(CODE, { not: 'an array' }), 'INVALID_INPUT');
  });

  it('rejects an empty array with INVALID_INPUT', () => {
    expectStrudelError(() => planEdits(CODE, []), 'INVALID_INPUT');
  });

  it('rejects an edit missing text with INVALID_INPUT', () => {
    expectStrudelError(
      () => planEdits(CODE, [{ range: { start: { line: 0, column: 0 }, end: { line: 0, column: 1 } } }]),
      'INVALID_INPUT',
    );
  });

  it('rejects total insertion greater than LIMITS.maxMutation with SOURCE_TOO_LARGE', () => {
    const bigText = 'x'.repeat(LIMITS.maxMutation + 1);
    expectStrudelError(() => planEdits(CODE, [edit(0, 0, bigText)]), 'SOURCE_TOO_LARGE');
  });
});

describe('applyChanges', () => {
  it('applies an empty change list as a no-op', () => {
    expect(applyChanges(CODE, [])).toBe(CODE);
  });

  it('applies a deletion', () => {
    expect(applyChanges(CODE, [{ from: 1, to: 3, insert: '' }])).toBe('adef');
  });
});

describe('validateReplacement', () => {
  it('accepts a valid string', () => {
    expect(validateReplacement('some code')).toBe('some code');
  });

  it('rejects a non-string with INVALID_INPUT', () => {
    expectStrudelError(() => validateReplacement(42), 'INVALID_INPUT');
  });

  it('rejects an oversize string with SOURCE_TOO_LARGE', () => {
    expectStrudelError(() => validateReplacement('x'.repeat(LIMITS.maxMutation + 1)), 'SOURCE_TOO_LARGE');
  });
});
