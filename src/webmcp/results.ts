import { toErrorPayload } from './errors';

/**
 * Wrap a tool body so it always resolves to a JSON-serializable value.
 * Structured errors are returned (not thrown): a rejected execute() promise reaches the agent
 * as an opaque failure with no payload.
 */
export function guarded<I extends Record<string, unknown>>(
  body: (input: I, signal: AbortSignal) => unknown | Promise<unknown>,
): WebMCP.ToolExecuteCallback {
  return async (input, options) => {
    try {
      return await body((input ?? {}) as I, options?.signal ?? new AbortController().signal);
    } catch (err) {
      return toErrorPayload(err);
    }
  };
}
