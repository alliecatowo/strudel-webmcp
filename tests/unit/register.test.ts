import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StrudelAdapter } from '../../src/strudel/types';
import { getModelContext, registerStrudelTools } from '../../src/webmcp/register';

function makeFakeAdapter(): StrudelAdapter {
  return {
    getCode: () => 'code',
    getCodeSlice: () => ({ code: 'code', codeHash: 'h', lineCount: 1, startLine: 0, endLine: 0, truncated: false }),
    getContext: () =>
      ({
        playback: { playing: false, dirty: false },
        editor: {
          codeHash: 'h',
          length: 4,
          lineCount: 1,
          cursor: { line: 0, column: 0, offset: 0 },
          selection: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 }, fromOffset: 0, toOffset: 0, empty: true, text: '', textTruncated: false },
        },
      }) as ReturnType<StrudelAdapter['getContext']>,
    applyEdits: () => ({ updated: true, codeHash: 'h', changes: 1, length: 4, lineCount: 1 }),
    replaceCode: () => ({ updated: true, codeHash: 'h', changes: 1, length: 4, lineCount: 1 }),
    evaluate: async () => ({ ok: true, playing: true, codeHash: 'h' }),
    play: async () => ({ playing: true, codeHash: 'h' }),
    stop: async () => ({ playing: false, codeHash: 'h' }),
    focusRange: () => ({ focused: true, codeHash: 'h', range: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 }, fromOffset: 0, toOffset: 0 } }),
  };
}

/** A fake WebMCP.ModelContext that records registerTool calls. */
function makeFakeModelContext(opts: { reject?: boolean } = {}): {
  modelContext: WebMCP.ModelContext;
  calls: { tool: WebMCP.ModelContextTool; options?: WebMCP.ModelContextRegisterToolOptions }[];
} {
  const calls: { tool: WebMCP.ModelContextTool; options?: WebMCP.ModelContextRegisterToolOptions }[] = [];
  const modelContext = {
    registerTool: async (tool: WebMCP.ModelContextTool, options?: WebMCP.ModelContextRegisterToolOptions) => {
      calls.push({ tool, options });
      if (opts.reject) throw new Error('registration failed');
    },
    getTools: async () => [],
    ontoolchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as WebMCP.ModelContext;
  return { modelContext, calls };
}

describe('registerStrudelTools', () => {
  // This test environment has no global `document`; registerStrudelTools falls back to it only
  // when modelContext is omitted/undefined, so stub a bare document (no modelContext) for that path.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers all 8 tools exactly once with a signal, and returns state ready with toolCount 8', async () => {
    const { modelContext, calls } = makeFakeModelContext();
    const { status, controller } = await registerStrudelTools(makeFakeAdapter(), modelContext);
    expect(status).toEqual({ state: 'ready', toolCount: 8 });
    expect(calls.length).toBe(8);
    const names = calls.map((c) => c.tool.name);
    expect(new Set(names).size).toBe(8);
    for (const call of calls) {
      expect(call.options?.signal).toBe(controller.signal);
    }
    expect(controller.signal.aborted).toBe(false);
  });

  it('returns unavailable and registers nothing with an undefined modelContext', async () => {
    vi.stubGlobal('document', {});
    const { status, controller } = await registerStrudelTools(makeFakeAdapter(), undefined);
    expect(status).toEqual({ state: 'unavailable' });
    expect(controller.signal.aborted).toBe(false);
  });

  it('returns error and aborts the controller when registerTool rejects', async () => {
    const { modelContext } = makeFakeModelContext({ reject: true });
    const { status, controller } = await registerStrudelTools(makeFakeAdapter(), modelContext);
    expect(status.state).toBe('error');
    if (status.state === 'error') {
      expect(status.message).toBe('registration failed');
    }
    expect(controller.signal.aborted).toBe(true);
  });
});

describe('getModelContext', () => {
  it('returns undefined for a document without modelContext', () => {
    const doc = {} as Document;
    expect(getModelContext(doc)).toBeUndefined();
  });
});
