/**
 * strudel.cc encodes shared code in the URL hash as base64 of the UTF-8 source
 * (`https://strudel.cc/#<base64>`). We read and write the same format so a version can be
 * opened in the upstream REPL, and links to this page carry code the same way.
 */
export function encodeShareHash(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeShareHash(hash: string): string | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return undefined;
  try {
    const bin = atob(decodeURIComponent(raw));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

export function strudelCcUrl(code: string): string {
  return `https://strudel.cc/#${encodeShareHash(code)}`;
}
