import type { StrudelMirrorLike } from './host';
import { StrudelError, aborted, bounded } from '../webmcp/errors';
import { LIMITS } from './types';

export function isPlaying(mirror: StrudelMirrorLike): boolean {
  return Boolean(mirror.repl?.scheduler?.started);
}

/**
 * Honest signal for browser autoplay policy: sticky user activation means an AudioContext may
 * resume. We never try to work around the policy.
 */
export function hasUserActivation(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
}

export function audioGestureRequired(): StrudelError {
  return new StrudelError(
    'AUDIO_GESTURE_REQUIRED',
    'Start playback once using the Strudel UI (press Play), then try again.',
  );
}

/**
 * Run Strudel's native Update path on the visible source and surface its error, if any.
 * repl.evaluate() swallows errors into repl.state.evalError, so we read it back.
 */
export async function evaluateVisible(mirror: StrudelMirrorLike, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw aborted();
  const abortPromise = new Promise<never>((_, reject) => {
    signal?.addEventListener('abort', () => reject(aborted()), { once: true });
  });
  await Promise.race([mirror.evaluate(), abortPromise]);
  if (signal?.aborted) throw aborted();
  const err = readEvalError(mirror);
  if (err) throw err;
}

/** Convert the REPL's swallowed evalError (if any) into a bounded structured error. */
export function readEvalError(mirror: StrudelMirrorLike): StrudelError | undefined {
  const err = mirror.repl.state.evalError;
  if (!err) return undefined;
  const details: Record<string, unknown> = {};
  if (err.loc && Number.isInteger(err.loc.line)) {
    details.line = Math.max(0, err.loc.line - 1);
    details.column = err.loc.column ?? 0;
  }
  return new StrudelError('EVALUATION_ERROR', bounded(err.message || 'Evaluation failed.', LIMITS.maxDiagnostic), details);
}
