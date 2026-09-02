import { describe, expect, it } from 'vitest';
import { bounded, StrudelError, toErrorPayload } from '../../src/webmcp/errors';
import { guarded } from '../../src/webmcp/results';

describe('toErrorPayload', () => {
  it('normalizes a StrudelError, including its details', () => {
    const err = new StrudelError('STALE_CODE', 'stale', { expectedCodeHash: 'a', currentCodeHash: 'b' });
    expect(toErrorPayload(err)).toEqual({
      error: 'STALE_CODE',
      message: 'stale',
      expectedCodeHash: 'a',
      currentCodeHash: 'b',
    });
  });

  it('normalizes a generic Error to INTERNAL_ERROR with no stack', () => {
    const payload = toErrorPayload(new Error('boom'));
    expect(payload.error).toBe('INTERNAL_ERROR');
    expect(payload.message).toBe('boom');
    expect(payload).not.toHaveProperty('stack');
  });

  it('normalizes an AbortError-named error to ABORTED', () => {
    const err = new Error('was aborted');
    err.name = 'AbortError';
    expect(toErrorPayload(err)).toMatchObject({ error: 'ABORTED' });
  });

  it('normalizes non-Error values', () => {
    expect(toErrorPayload('just a string')).toEqual({ error: 'INTERNAL_ERROR', message: 'just a string' });
    expect(toErrorPayload(42)).toEqual({ error: 'INTERNAL_ERROR', message: '42' });
    expect(toErrorPayload(null)).toEqual({ error: 'INTERNAL_ERROR', message: 'null' });
  });
});

describe('bounded', () => {
  it('leaves short text untouched', () => {
    expect(bounded('short', 10)).toBe('short');
  });

  it('truncates text longer than max and appends an ellipsis', () => {
    const text = 'x'.repeat(20);
    const result = bounded(text, 10);
    expect(result.length).toBe(11); // 10 chars + ellipsis
    expect(result.startsWith('x'.repeat(10))).toBe(true);
  });
});

describe('guarded', () => {
  it('resolves to the body value on success', async () => {
    const tool = guarded(() => ({ ok: true }));
    const result = await tool({}, { signal: new AbortController().signal });
    expect(result).toEqual({ ok: true });
  });

  it('resolves to an error payload (never rejects) when the body throws synchronously', async () => {
    const tool = guarded(() => {
      throw new StrudelError('INVALID_INPUT', 'nope');
    });
    const result = await tool({}, { signal: new AbortController().signal });
    expect(result).toEqual({ error: 'INVALID_INPUT', message: 'nope' });
  });

  it('resolves to an error payload when the body rejects asynchronously', async () => {
    const tool = guarded(async () => {
      throw new Error('async boom');
    });
    const result = await tool({}, { signal: new AbortController().signal });
    expect(result).toMatchObject({ error: 'INTERNAL_ERROR', message: 'async boom' });
  });

  it('passes the AbortSignal from options through to the body', async () => {
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;
    const tool = guarded((_input, signal) => {
      seenSignal = signal;
    });
    await tool({}, { signal: controller.signal });
    expect(seenSignal).toBe(controller.signal);
  });
});
