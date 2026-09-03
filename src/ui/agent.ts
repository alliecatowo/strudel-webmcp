import type { Session, AgentMode } from '../strudel/session';
import type { StrudelAdapter } from '../strudel/types';
import { unifiedDiff } from '../strudel/diff';
import { hashCode } from '../strudel/revisions';

/**
 * Human-side controls that share state with the agent tools: the mode dial, the
 * pending-change bar (review mode), and the "what is sounding" notice. All use
 * the adapter exactly like the tools do; none of this is agent-branded — a
 * proposal reads like a code-review suggestion, a take is a take.
 */
export function wireAgentControls(session: Session, adapter: StrudelAdapter): void {
  const modeControl = document.getElementById('mode-control');
  const bar = document.getElementById('proposal-bar');
  const summary = document.getElementById('proposal-summary');
  const lines = document.getElementById('proposal-lines');
  const diffBox = document.getElementById('proposal-diff') as HTMLDetailsElement | null;
  const diffText = document.getElementById('proposal-diff-text');
  const notice = document.getElementById('playback-notice');
  const noticeText = document.getElementById('notice-text');

  modeControl?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
    b.addEventListener('click', () => session.setMode(b.dataset.mode as AgentMode));
  });
  const act = (fn: () => unknown) => () => {
    void Promise.resolve()
      .then(fn)
      .catch((err: unknown) => console.warn('[strudel-webmcp]', err));
  };
  document.getElementById('btn-proposal-show')?.addEventListener('click', act(() => {
    const p = session.state.proposal;
    if (!p) return;
    const first = p.changes[0];
    const last = p.changes[p.changes.length - 1];
    if (!first || !last) return;
    const base = adapter.getCode();
    if (hashCode(base) !== p.baseCodeHash) return;
    const pos = (o: number) => {
      let line = 0;
      let col = 0;
      for (let i = 0; i < o && i < base.length; i++) {
        if (base.charCodeAt(i) === 10) {
          line++;
          col = 0;
        } else col++;
      }
      return { line, column: col };
    };
    adapter.focusRange({ start: pos(first.from), end: pos(last.to) });
    if (diffBox) diffBox.open = true;
  }));
  document.getElementById('btn-proposal-audition')?.addEventListener('click', act(() => adapter.auditionProposal()));
  document.getElementById('btn-proposal-accept')?.addEventListener('click', act(() => adapter.acceptProposal()));
  document.getElementById('btn-proposal-discard')?.addEventListener('click', act(() => adapter.discardProposal()));
  document.getElementById('notice-return')?.addEventListener('click', act(() => adapter.returnFromAudition()));

  const lineSpan = (startLine: number, endLine: number) =>
    startLine === endLine ? `line ${startLine + 1}` : `lines ${startLine + 1}–${endLine + 1}`;

  const render = () => {
    const st = session.state;
    modeControl?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.mode === st.mode));
    });
    modeControl?.setAttribute('data-mode', st.mode);
    const p = st.proposal;
    if (bar) bar.hidden = !p;
    if (diffBox) diffBox.hidden = !p;
    if (p) {
      if (summary) summary.textContent = p.summary;
      if (lines) lines.textContent = lineSpan(p.lineRange.start, p.lineRange.end);
      if (diffText) {
        const base = adapter.getCode();
        diffText.replaceChildren();
        if (hashCode(base) === p.baseCodeHash) {
          renderDiff(diffText, unifiedDiff(base, p.code, 8000));
        } else {
          const note = document.createElement('span');
          note.className = 'stale-note';
          note.textContent = 'The code changed after this change was proposed — discard and ask again.';
          diffText.append(note);
        }
      }
      const auditionBtn = document.getElementById('btn-proposal-audition') as HTMLButtonElement | null;
      if (auditionBtn) auditionBtn.textContent = st.auditioning ? 'Auditioning…' : 'Audition';
    }
    // One quiet notice for "something other than the whole document is sounding".
    if (notice) {
      if (st.auditioning) {
        notice.dataset.kind = 'audition';
        notice.hidden = false;
        if (noticeText) noticeText.textContent = `Auditioning the proposed change${p?.summary ? ` — ${p.summary}` : ''}`;
      } else if (st.solo) {
        notice.dataset.kind = 'solo';
        notice.hidden = false;
        if (noticeText) noticeText.textContent = `Soloing ${lineSpan(st.solo.range.start.line, st.solo.range.end.line)} — the rest is muted`;
      } else {
        notice.hidden = true;
      }
    }
  };
  session.addEventListener('change', render);
  render();
}

/** Render a unified diff as colored +/- lines, like a review comment in the editor. */
function renderDiff(el: HTMLElement, diff: string): void {
  for (const line of diff.split('\n')) {
    if (!line) continue;
    const span = document.createElement('span');
    span.className = line.startsWith('+') ? 'ins' : line.startsWith('-') ? 'del' : line.startsWith('@') ? 'hunk' : 'context';
    span.textContent = line.length > 200 ? `${line.slice(0, 200)}…` : line;
    el.append(span);
  }
}
