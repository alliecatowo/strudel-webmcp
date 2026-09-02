/**
 * Deterministic, non-cryptographic hash over the exact editor source.
 * Two independent 32-bit FNV-1a passes plus the length give a compact, collision-resistant-enough
 * revision token for collaborative stale-write protection.
 */
export function hashCode(code: string): string {
  let a = 0x811c9dc5;
  let b = 0x050c5d1f;
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    a ^= c;
    a = Math.imul(a, 0x01000193) >>> 0;
    b ^= c;
    b = Math.imul(b, 0x01000193) >>> 0;
    b ^= b >>> 13;
  }
  return `${hex32(a)}${hex32(b)}-${code.length.toString(16)}`;
}

function hex32(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}
