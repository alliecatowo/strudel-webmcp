/**
 * Strudel's sound registry, reached through the same user-facing globals pattern code uses
 * (`samples()`, `soundMap`). Nothing here is an agent-only copy; it is the registry the
 * scheduler resolves `s("...")` against.
 */
import { StrudelError } from '../webmcp/errors';

interface SoundEntry {
  data?: { type?: string; tag?: string; samples?: unknown; baseUrl?: string };
}

interface StrudelGlobals {
  samples?: (sources: Record<string, unknown> | string, baseUrl?: string, options?: Record<string, unknown>) => Promise<unknown>;
  soundMap?: { get(): Record<string, SoundEntry> };
}

const g = () => globalThis as unknown as StrudelGlobals;

export interface SoundInfo {
  name: string;
  type: string;
  tag?: string;
  variants?: number;
}

export function isSoundRegistryReady(): boolean {
  return typeof g().samples === 'function' && typeof g().soundMap?.get === 'function';
}

export function listSounds(query?: string, limit = 100): { total: number; sounds: SoundInfo[]; truncated: boolean } {
  const map = g().soundMap?.get() ?? {};
  const q = query?.trim().toLowerCase();
  const all = Object.entries(map)
    .filter(([name]) => !q || name.toLowerCase().includes(q))
    .map(([name, entry]) => {
      const s = entry.data?.samples;
      const variants = Array.isArray(s) ? s.length : s && typeof s === 'object' ? Object.keys(s).length : undefined;
      const info: SoundInfo = { name, type: entry.data?.type ?? 'unknown' };
      if (entry.data?.tag) info.tag = entry.data.tag;
      if (variants !== undefined) info.variants = variants;
      return info;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const sounds = all.slice(0, Math.max(1, Math.min(500, limit)));
  return { total: all.length, sounds, truncated: sounds.length < all.length };
}

export function hasSound(name: string): boolean {
  return Boolean(g().soundMap?.get()?.[name]);
}

const MAX_DATA_URL = 4_000_000; // ~3 MB of audio as base64

/** Register samples through Strudel's own `samples()`; returns the names now available. */
export async function loadSamples(sources: unknown, baseUrl?: string): Promise<string[]> {
  const samples = g().samples;
  if (!samples) throw new StrudelError('REPL_NOT_READY', 'Strudel has not finished loading its sound registry yet.');
  if (typeof sources === 'string') {
    if (!/^(github:|https?:\/\/)/.test(sources)) {
      throw new StrudelError('INVALID_INPUT', 'A string source must be a github:user/repo shortcut or an https URL to a strudel.json.');
    }
    const before = new Set(Object.keys(g().soundMap?.get() ?? {}));
    await samples(sources);
    return Object.keys(g().soundMap?.get() ?? {}).filter((n) => !before.has(n));
  }
  if (!sources || typeof sources !== 'object' || Array.isArray(sources)) {
    throw new StrudelError('INVALID_INPUT', 'sources must be an object of { name: url | [urls] | dataUrl } or a github:/https string.');
  }
  const entries = Object.entries(sources as Record<string, unknown>);
  if (entries.length === 0) throw new StrudelError('INVALID_INPUT', 'sources is empty.');
  for (const [name, value] of entries) {
    if (!/^[a-z0-9_\-:.]+$/i.test(name)) throw new StrudelError('INVALID_INPUT', `sample name "${name}" must be alphanumeric/_/-/./:`);
    const urls = Array.isArray(value) ? value : [value];
    for (const u of urls) {
      if (typeof u !== 'string') throw new StrudelError('INVALID_INPUT', `sample "${name}" must map to a URL string or array of URL strings.`);
      if (u.startsWith('data:')) {
        if (!u.startsWith('data:audio/')) throw new StrudelError('INVALID_INPUT', `sample "${name}" data URL must be audio/*.`);
        if (u.length > MAX_DATA_URL) throw new StrudelError('SOURCE_TOO_LARGE', `sample "${name}" exceeds the ${MAX_DATA_URL}-character data URL limit.`);
      } else if (!/^(https?:|blob:)/.test(u)) {
        throw new StrudelError('INVALID_INPUT', `sample "${name}" must be an https, blob or data URL.`);
      }
    }
  }
  await samples(sources as Record<string, unknown>, baseUrl);
  return entries.map(([name]) => name).filter((n) => hasSound(n));
}

/** Human upload: register local audio files under their file-name stems. */
export async function loadSampleFiles(files: File[]): Promise<{ name: string; durationMs?: number }[]> {
  const sources: Record<string, string> = {};
  const out: { name: string; durationMs?: number }[] = [];
  for (const file of files) {
    if (!file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|flac|m4a|aiff?)$/i.test(file.name)) continue;
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_\-]+/gi, '_').toLowerCase() || `clip_${out.length}`;
    sources[name] = URL.createObjectURL(file);
    out.push({ name });
  }
  if (out.length === 0) throw new StrudelError('INVALID_INPUT', 'No audio files found.');
  const loaded = await loadSamples(sources);
  return out.filter((o) => loaded.includes(o.name));
}
