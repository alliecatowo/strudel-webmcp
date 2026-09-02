import type { StrudelErrorCode, StrudelErrorPayload } from '../strudel/types';

/** Structured, bounded error used across the adapter and the WebMCP tools. */
export class StrudelError extends Error {
  readonly code: StrudelErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: StrudelErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'StrudelError';
    this.code = code;
    this.details = details;
  }

  toPayload(): StrudelErrorPayload {
    return { error: this.code, message: this.message, ...this.details };
  }
}

export function staleCode(expectedCodeHash: string, currentCodeHash: string): StrudelError {
  return new StrudelError('STALE_CODE', 'The Strudel source changed since it was read. Re-read the code and retry.', {
    expectedCodeHash,
    currentCodeHash,
  });
}

export function aborted(): StrudelError {
  return new StrudelError('ABORTED', 'The tool call was aborted before it completed.');
}

const MAX_MESSAGE = 500;

/** Normalize anything thrown into a structured error payload. Never leaks stack traces. */
export function toErrorPayload(err: unknown): StrudelErrorPayload {
  if (err instanceof StrudelError) return err.toPayload();
  if (err instanceof Error) {
    if (err.name === 'AbortError') return aborted().toPayload();
    return { error: 'INTERNAL_ERROR', message: bounded(err.message || err.name) };
  }
  return { error: 'INTERNAL_ERROR', message: bounded(String(err)) };
}

export function bounded(text: string, max = MAX_MESSAGE): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function isErrorPayload(value: unknown): value is StrudelErrorPayload {
  return typeof value === 'object' && value !== null && typeof (value as StrudelErrorPayload).error === 'string';
}
