import type { Session, AgentMode } from '../strudel/session';
import type { StrudelAdapter } from '../strudel/types';
import { unifiedDiff } from '../strudel/diff';
import { hashCode } from '../strudel/revisions';

/** Mode control, proposal bar, solo/audition chips. All human-side; uses the adapter like the tools do. */
export function wireAgentControls(session: Session, adapter: StrudelAdapter): void {
  const modeControl = document.getElementById('mode-control');
  const bar = document.getElementById('proposal-bar');
  const summary = document.getElementById('proposal-summary');
  const lines = document.getElementById('proposal-lines');
  const diffBox = document.getElementById('proposal-diff') as HTMLDetailsElement | null;
  const diffText = document.getElementById('proposal-diff-text');
  const chipSolo = document.getElementById('chip-solo');
  const chipSoloRange = document.getElementById('chip-solo-range');
  const chipAudition = document.getElementById('chip-audition');

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
  chipSolo?.addEventListener('click', act(() => adapter.returnFromAudition()));
  chipAudition?.addEventListener('click', act(() => adapter.returnFromAudition()));

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
      if (lines) lines.textContent = p.lineRange.start === p.lineRange.end ? `line ${p.lineRange.start + 1}` : `lines ${p.lineRange.start + 1}–${p.lineRange.end + 1}`;
      if (diffText) {
        const base = adapter.getCode();
        diffText.textContent = hashCode(base) === p.baseCodeHash ? unifiedDiff(base, p.code, 8000) : '(document changed since this proposal was made)';
      }
      const auditionBtn = document.getElementById('btn-proposal-audition') as HTMLButtonElement | null;
      if (auditionBtn) auditionBtn.textContent = st.auditioning ? 'Auditioning…' : 'Audition';
    }
    if (chipAudition) chipAudition.hidden = !st.auditioning;
    if (chipSolo) {
      chipSolo.hidden = !st.solo;
      if (st.solo && chipSoloRange) {
        const { start, end } = st.solo.range;
        chipSoloRange.textContent = start.line === end.line ? `line ${start.line + 1}` : `lines ${start.line + 1}–${end.line + 1}`;
      }
    }
  };
  session.addEventListener('change', render);
  render();
}
