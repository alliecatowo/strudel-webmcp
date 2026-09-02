/**
 * TEST-ONLY WebMCP shim. Installed via page.addInitScript before the app loads so that
 * `document.modelContext` exists in Playwright's Chromium. Never shipped in production.
 *
 * Mirrors the spec surface the app uses: registerTool(tool, {signal}) → Promise<void>,
 * execute(input, {signal}), getTools(). Adds a test hook window.__webmcp for inspection.
 */
export function installWebMcpShim(): void {
  type Tool = WebMCP.ModelContextTool;
  const tools = new Map<string, Tool>();
  const registrations: string[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const modelContext = {
    async registerTool(tool: Tool, options?: WebMCP.ModelContextRegisterToolOptions): Promise<void> {
      if (!tool || typeof tool.name !== 'string' || typeof tool.execute !== 'function') {
        throw new TypeError('invalid tool');
      }
      if (tools.has(tool.name)) throw new DOMException(`tool ${tool.name} already registered`, 'InvalidStateError');
      tools.set(tool.name, tool);
      registrations.push(tool.name);
      options?.signal?.addEventListener('abort', () => {
        tools.delete(tool.name);
        notify();
      });
      notify();
    },
    async getTools() {
      return [...tools.values()].map((t) => ({
        name: t.name,
        title: t.title ?? t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
        origin: location.origin,
        window,
      }));
    },
    ontoolchange: null,
    addEventListener(type: string, cb: () => void) {
      if (type === 'toolchange') listeners.add(cb);
    },
    removeEventListener(type: string, cb: () => void) {
      if (type === 'toolchange') listeners.delete(cb);
    },
    dispatchEvent() {
      return true;
    },
  };

  Object.defineProperty(document, 'modelContext', { value: modelContext, configurable: true });

  (window as unknown as { __webmcp: unknown }).__webmcp = {
    registrations,
    toolNames: () => [...tools.keys()],
    definition: (name: string) => {
      const t = tools.get(name);
      return t ? { name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations } : undefined;
    },
    /** Execute a registered tool the way a browser agent would, with an AbortSignal. */
    async call(name: string, input: Record<string, unknown> = {}, abortAfterMs?: number) {
      const t = tools.get(name);
      if (!t) throw new Error(`tool ${name} not registered`);
      const controller = new AbortController();
      if (abortAfterMs !== undefined) setTimeout(() => controller.abort(), abortAfterMs);
      const p = t.execute(input, { signal: controller.signal });
      if (abortAfterMs === 0) controller.abort();
      return JSON.parse(JSON.stringify(await p));
    },
  };
}
