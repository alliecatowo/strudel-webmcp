/** Small line-based unified diff (LCS), bounded, for showing a proposal to humans and agents. */
export interface DiffLine {
  kind: ' ' | '+' | '-';
  text: string;
}

export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = A.length;
  const m = B.length;
  // LCS table (docs are small: bounded by LIMITS elsewhere)
  const dp: Uint16Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]!;
    const next = dp[i + 1]!;
    for (let j = m - 1; j >= 0; j--) {
      row[j] = A[i] === B[j] ? (next[j + 1] ?? 0) + 1 : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ kind: ' ', text: A[i]! });
      i++;
      j++;
    } else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
      out.push({ kind: '-', text: A[i]! });
      i++;
    } else {
      out.push({ kind: '+', text: B[j]! });
      j++;
    }
  }
  while (i < n) out.push({ kind: '-', text: A[i++]! });
  while (j < m) out.push({ kind: '+', text: B[j++]! });
  return out;
}

/** Unified-style text with 2 lines of context around each change; truncated to maxChars. */
export function unifiedDiff(a: string, b: string, maxChars = 8000, context = 2): string {
  const lines = diffLines(a, b);
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.kind === ' ') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
  });
  const parts: string[] = [];
  let gap = false;
  lines.forEach((l, idx) => {
    if (!keep[idx]) {
      gap = true;
      return;
    }
    if (gap && parts.length) parts.push('…');
    gap = false;
    parts.push(`${l.kind}${l.text}`);
  });
  const text = parts.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(truncated)` : text;
}
