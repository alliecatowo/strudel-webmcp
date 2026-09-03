import { isErrorPayload, toErrorPayload } from './errors';

/**
 * Wrap a tool body so it always resolves to a JSON-serializable value.
 * Structured errors are returned (not thrown): a rejected execute() promise reaches the agent
 * as an opaque failure with no payload.
 */
export function guarded<I extends object>(
  body: (input: I, signal: AbortSignal) => unknown | Promise<unknown>,
  toolName?: string,
): WebMCP.ToolExecuteCallback {
  return async (input, options) => {
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    let result: unknown;
    try {
      result = await body((input ?? {}) as I, options?.signal ?? new AbortController().signal);
    } catch (err) {
      result = toErrorPayload(err);
    }
    if (toolName) announceActivity(toolName, result, started);
    return result;
  };
}

export const ACTIVITY_EVENT = 'strudel-webmcp:activity';

export interface ActivityDetail {
  tool: string;
  ok: boolean;
  error?: string;
  ms: number;
}

/** Tell the page (status strip) that a tool ran. Purely cosmetic; never wakes an agent. */
function announceActivity(tool: string, result: unknown, started: number): void {
  if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') return;
  const errored = isErrorPayload(result);
  const detail: ActivityDetail = {
    tool,
    ok: !errored,
    ...(errored ? { error: result.error } : {}),
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - started),
  };
  document.dispatchEvent(new CustomEvent<ActivityDetail>(ACTIVITY_EVENT, { detail }));
}
