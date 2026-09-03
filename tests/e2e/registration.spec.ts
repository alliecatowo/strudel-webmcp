import { test, expect } from '@playwright/test';
import { openWithShim } from './helpers';

const EXPECTED_TOOL_NAMES = [
  'strudel_get_context',
  'strudel_get_code',
  'strudel_apply_edits',
  'strudel_replace_code',
  'strudel_evaluate',
  'strudel_play',
  'strudel_stop',
  'strudel_focus_range',
  'strudel_record',
  'strudel_list_sounds',
  'strudel_load_samples',
  'strudel_snapshot',
  'strudel_set_theme',
];

const READ_ONLY_TOOL_NAMES = ['strudel_get_context', 'strudel_get_code', 'strudel_list_sounds'];

interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: { type?: string };
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
}

async function registrations(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __webmcp: { registrations: string[] } }).__webmcp.registrations);
}

async function definition(page: import('@playwright/test').Page, name: string): Promise<ToolDefinition | undefined> {
  return page.evaluate(
    (n) => (window as unknown as { __webmcp: { definition: (n: string) => ToolDefinition | undefined } }).__webmcp.definition(n),
    name,
  );
}

test.describe('WebMCP tool registration', () => {
  test('exactly the 13 expected tools are registered once each, in order', async ({ page }) => {
    await openWithShim(page);
    const regs = await registrations(page);
    expect(regs).toHaveLength(13);
    expect(regs).toEqual(EXPECTED_TOOL_NAMES);
    expect(new Set(regs).size).toBe(13);
  });

  test('strudel_get_context, strudel_get_code and strudel_list_sounds are read-only and untrusted-content', async ({ page }) => {
    await openWithShim(page);
    for (const name of READ_ONLY_TOOL_NAMES) {
      const def = await definition(page, name);
      expect(def?.annotations?.readOnlyHint).toBe(true);
      expect(def?.annotations?.untrustedContentHint).toBe(true);
    }
  });

  test('every tool has a description and an object inputSchema', async ({ page }) => {
    await openWithShim(page);
    for (const name of EXPECTED_TOOL_NAMES) {
      const def = await definition(page, name);
      expect(def, `missing definition for ${name}`).toBeTruthy();
      expect(typeof def?.description).toBe('string');
      expect(def?.description?.length ?? 0).toBeGreaterThan(0);
      expect(def?.inputSchema).toBeTruthy();
      expect(def?.inputSchema?.type).toBe('object');
    }
  });

  test('mutating tools are not marked read-only', async ({ page }) => {
    await openWithShim(page);
    const mutating = EXPECTED_TOOL_NAMES.filter((n) => !READ_ONLY_TOOL_NAMES.includes(n));
    for (const name of mutating) {
      const def = await definition(page, name);
      expect(def?.annotations?.readOnlyHint, `${name} should not be readOnly`).not.toBe(true);
    }
  });
});
