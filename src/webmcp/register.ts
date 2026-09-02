import type { StrudelAdapter } from '../strudel/types';
import { buildStrudelTools } from './tools';

export type WebMcpStatus =
  | { state: 'unavailable' }
  | { state: 'ready'; toolCount: number }
  | { state: 'error'; message: string };

/** Detect the browser's WebMCP entry point. Never polyfilled in production. */
export function getModelContext(doc: Document = document): WebMCP.ModelContext | undefined {
  if (!('modelContext' in doc)) return undefined;
  const mc = doc.modelContext;
  return mc && typeof mc.registerTool === 'function' ? mc : undefined;
}

/**
 * Register the Strudel tools once. Returns the status for the UI and an AbortController that
 * unregisters all tools (WebMCP registration signal).
 */
export async function registerStrudelTools(
  adapter: StrudelAdapter,
  modelContext: WebMCP.ModelContext | undefined = getModelContext(),
): Promise<{ status: WebMcpStatus; controller: AbortController }> {
  const controller = new AbortController();
  if (!modelContext) return { status: { state: 'unavailable' }, controller };
  const tools = buildStrudelTools(adapter);
  try {
    for (const tool of tools) {
      await modelContext.registerTool(tool, { signal: controller.signal });
    }
    return { status: { state: 'ready', toolCount: tools.length }, controller };
  } catch (err) {
    controller.abort();
    return { status: { state: 'error', message: err instanceof Error ? err.message : String(err) }, controller };
  }
}
