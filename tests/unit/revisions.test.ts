import { describe, expect, it } from 'vitest';
import { hashCode } from '../../src/strudel/revisions';

describe('hashCode', () => {
  it('returns the same hash for the same code', () => {
    const code = 's("bd sd hh sd").slow(2)';
    expect(hashCode(code)).toBe(hashCode(code));
  });

  it('returns a different hash for a one-character numeric change (slider move)', () => {
    const before = 's("bd").gain(600)';
    const after = 's("bd").gain(601)';
    expect(hashCode(before)).not.toBe(hashCode(after));
  });

  it('returns a different hash for otherwise different code', () => {
    expect(hashCode('a')).not.toBe(hashCode('b'));
  });

  it('is stable for the empty string', () => {
    const h1 = hashCode('');
    const h2 = hashCode('');
    expect(h1).toBe(h2);
    expect(typeof h1).toBe('string');
    expect(h1.length).toBeGreaterThan(0);
  });

  it('returns a plain string with no whitespace', () => {
    const h = hashCode('some strudel code\nwith multiple\nlines');
    expect(typeof h).toBe('string');
    expect(h).not.toMatch(/\s/);
  });
});
