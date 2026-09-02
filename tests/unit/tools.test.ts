import { describe, expect, it } from 'vitest';
import type { StrudelAdapter } from '../../src/strudel/types';
import { buildStrudelTools, STRUDEL_TOOL_NAMES } from '../../src/webmcp/tools';

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

describe('buildStrudelTools', () => {
  it('returns exactly the 8 tool names in STRUDEL_TOOL_NAMES order, each with a description, inputSchema, and execute', () => {
    const tools = buildStrudelTools(makeFakeAdapter());
    expect(tools.map((t) => t.name)).toEqual([...STRUDEL_TOOL_NAMES]);
    expect(tools.length).toBe(8);
    for (const tool of tools) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeTruthy();
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('marks strudel_get_context and strudel_get_code as readOnlyHint + untrustedContentHint', () => {
    const tools = buildStrudelTools(makeFakeAdapter());
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName.strudel_get_context?.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
    expect(byName.strudel_get_code?.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
  });

  it('marks the mutating tools as readOnlyHint: false', () => {
    const tools = buildStrudelTools(makeFakeAdapter());
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    const mutating = ['strudel_apply_edits', 'strudel_replace_code', 'strudel_evaluate', 'strudel_play', 'strudel_stop', 'strudel_focus_range'];
    for (const name of mutating) {
      expect(byName[name]?.annotations?.readOnlyHint).toBe(false);
    }
  });
});
