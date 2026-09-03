// Strudel WebMCP: the normal Strudel REPL, progressively enhanced with WebMCP tools.
// Copyright (C) 2026 Allison Coleman. AGPL-3.0-only. See LICENSE.
import { MasterTap, recordMaster } from './strudel/audio-tap';
import '@strudel/repl';
import { DEMO_PATTERN } from './demo-pattern';
import { createStrudelAdapter } from './strudel/adapter';
import type { StrudelEditorElement } from './strudel/host';
import { Session } from './strudel/session';
import { decodeShareHash } from './strudel/share';
import { loadSampleFiles } from './strudel/sounds';
import { registerStrudelTools } from './webmcp/register';
import { renderWebMcpStatus, wireActivityIndicator } from './ui/status';
import { createRecordingsTray } from './ui/recordings';
import { wireAgentControls } from './ui/agent';
import { wireShelf } from './ui/shelf';

// Observe connections to the speakers before Strudel builds its audio graph (it does so lazily
// on first evaluation, so this only needs to run before the human presses Play).
const tap = new MasterTap();
tap.install();

function mountRepl(): StrudelEditorElement {
  const mount = document.getElementById('repl-mount');
  if (!mount) throw new Error('missing #repl-mount');
  const host = document.createElement('strudel-editor') as StrudelEditorElement;
  // Same URL-hash format as strudel.cc, so shared links open here too.
  host.setAttribute('code', decodeShareHash(location.hash) ?? DEMO_PATTERN);
  mount.append(host);
  return host;
}

function wireTransport(host: StrudelEditorElement, session: Session, adapter: ReturnType<typeof createStrudelAdapter>): void {
  const play = document.getElementById('btn-play') as HTMLButtonElement | null;
  const playLabel = play?.querySelector<HTMLElement>('.btn-label') ?? null;
  const update = document.getElementById('btn-update') as HTMLButtonElement | null;
  const solo = document.getElementById('btn-solo') as HTMLButtonElement | null;
  const rec = document.getElementById('btn-rec') as HTMLButtonElement | null;
  const errorBox = document.getElementById('eval-error');
  // Last evaluated code seen on the REPL's own update events. When an evaluation lands whose
  // code is the visible document, the whole document is what is sounding — so any solo/audition
  // notice is over, whoever triggered the evaluation (human Ctrl+Enter, native toggle, or agent).
  // Derived evaluations (solo/audition) land a different string and leave the notice alone.
  let lastActiveCode: string | undefined;
  // Native REPL paths only: toggle() = evaluate when stopped / stop when playing.
  play?.addEventListener('click', () => void host.editor?.toggle());
  update?.addEventListener('click', () => void adapter.returnFromAudition().catch(() => undefined));
  const runSelection = () => {
    const ctx = adapter.getContext();
    if (ctx.editor.selection.empty) return;
    void adapter.soloRange({ start: ctx.editor.selection.start, end: ctx.editor.selection.end }).catch(() => undefined);
  };
  solo?.addEventListener('click', runSelection);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runSelection();
    }
  });
  // Enable "Run selection" only when there is a selection (poll cheaply on selection changes).
  document.addEventListener('selectionchange', () => {
    if (!solo) return;
    try {
      solo.disabled = adapter.getContext().editor.selection.empty;
    } catch {
      solo.disabled = true;
    }
  });
  host.addEventListener('update', (ev) => {
    const detail = (ev as CustomEvent<{ started?: boolean; error?: Error; isDirty?: boolean; activeCode?: unknown }>).detail;
    const started = Boolean(detail?.started);
    const landed = typeof detail?.activeCode === 'string' ? detail.activeCode : undefined;
    if (landed !== undefined && landed !== lastActiveCode) {
      lastActiveCode = landed;
      try {
        if (landed === adapter.getCode()) {
          session.setSolo(undefined);
          session.setAuditioning(false);
        }
      } catch {
        /* editor not ready yet; ignore */
      }
    }
    if (play) {
      play.dataset.playing = String(started);
      if (playLabel) playLabel.textContent = started ? 'Stop' : 'Play';
      play.setAttribute('aria-label', started ? 'Stop playback' : 'Start playback');
    }
    if (update) update.dataset.dirty = String(Boolean(detail?.isDirty) && !session.state.solo && !session.state.auditioning);
    if (rec && !session.state.recording) rec.disabled = !started;
    if (!started && (session.state.solo || session.state.auditioning)) {
      session.setSolo(undefined);
      session.setAuditioning(false);
    }
    // Either side can end anyone's take: stopping the scheduler gracefully ends a recording
    // in progress (the captured clip is kept), whether the human or the agent started it.
    if (!started) session.state.recording?.stop();
    // Human and agent see the same failure: mirror the REPL's own error state, nothing more.
    if (errorBox) {
      const message = detail?.error?.message;
      errorBox.hidden = !message;
      errorBox.textContent = message ? `Error: ${message}` : '';
    }
  });
}

/** Record control: press to start, press again to stop (auto-stops at 5 min). Also stops tool-triggered takes. */
function wireRecordControl(session: Session, tray: ReturnType<typeof createRecordingsTray>): void {
  const rec = document.getElementById('btn-rec') as HTMLButtonElement | null;
  if (!rec) return;
  const time = rec.querySelector<HTMLElement>('.rec-time');
  let ticker: number | undefined;
  session.addEventListener('change', () => {
    const r = session.state.recording;
    rec.dataset.recording = String(Boolean(r));
    if (ticker) window.clearInterval(ticker);
    ticker = undefined;
    if (r) {
      rec.disabled = false;
      if (time) time.hidden = false;
      const tick = () => {
        const s = ((Date.now() - r.startedAt) / 1000).toFixed(1);
        if (time) time.textContent = `${s} s`;
        rec.setAttribute('aria-label', `Stop recording (${s} s)`);
      };
      tick();
      ticker = window.setInterval(tick, 100);
    } else {
      if (time) {
        time.hidden = true;
        time.textContent = '';
      }
      rec.setAttribute('aria-label', 'Record the live output');
    }
  });
  rec.addEventListener('click', async () => {
    const active = session.state.recording;
    if (active) {
      active.stop();
      return;
    }
    const stopper = new AbortController();
    const label = `take ${new Date().toLocaleTimeString()}`;
    session.setRecording({ label, startedAt: Date.now(), stop: () => stopper.abort() });
    try {
      const clip = await recordMaster(tap, { maxMs: 300_000, until: stopper.signal });
      tray.add({ id: `clip-${Date.now().toString(36)}`, label, blob: clip.blob, buffer: clip.buffer, durationMs: Math.round(clip.buffer.duration * 1000) });
    } catch (err) {
      console.warn('[strudel-webmcp] recording failed', err);
    } finally {
      session.setRecording(undefined);
    }
  });
}

function wireSamplesAndVersions(session: Session, adapter: ReturnType<typeof createStrudelAdapter>): void {
  const input = document.getElementById('input-samples') as HTMLInputElement | null;
  const dropzone = document.getElementById('dropzone');
  const addFiles = async (files: File[]) => {
    try {
      const loaded = await loadSampleFiles(files);
      session.addSamples(loaded.map((l) => ({ name: l.name })));
    } catch (err) {
      console.warn('[strudel-webmcp] sample import failed', err);
    }
  };
  input?.addEventListener('change', () => {
    if (input.files?.length) void addFiles([...input.files]);
    input.value = '';
  });
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    dragDepth++;
    if (dropzone) dropzone.hidden = false;
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0 && dropzone) dropzone.hidden = true;
  });
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    dragDepth = 0;
    if (dropzone) dropzone.hidden = true;
    void addFiles([...e.dataTransfer.files]);
  });
  document.getElementById('btn-save-version')?.addEventListener('click', () => adapter.snapshot());
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const code = adapter.getCode();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    a.download = `strudel-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.strudel`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

async function main(): Promise<void> {
  await customElements.whenDefined('strudel-editor');
  const host = mountRepl();
  const session = new Session();
  const tray = createRecordingsTray(document.getElementById('recordings'));
  const themes = Object.keys(((globalThis as { themes?: Record<string, unknown> }).themes ?? {})) ;
  const adapter = createStrudelAdapter(host, {
    tap,
    session,
    themes: themes.length ? themes : KNOWN_THEMES,
    onRecording: (clip) => tray.add(clip),
  });

  wireTransport(host, session, adapter);
  wireRecordControl(session, tray);
  wireAgentControls(session, adapter);
  wireShelf(session, adapter);
  wireSamplesAndVersions(session, adapter);

  const statusEl = document.getElementById('webmcp-status');
  wireActivityIndicator(statusEl);
  const { status } = await registerStrudelTools(adapter);
  renderWebMcpStatus(statusEl, status);
}

/** Theme names shipped with @strudel/codemirror 1.2.0 (verified against the pinned bundle). */
const KNOWN_THEMES = [
  'strudelTheme', 'algoboy', 'androidstudio', 'atomone', 'aura', 'bbedit', 'blackscreen', 'bluescreen', 'CutiePi', 'darcula', 'dracula',
  'duotoneDark', 'eclipse', 'githubDark', 'githubLight', 'greenText', 'gruvboxDark', 'gruvboxLight', 'sonicPink', 'materialDark',
  'materialLight', 'monokai', 'noctisLilac', 'nord', 'redText', 'solarizedDark', 'solarizedLight', 'sublime', 'teletext', 'tokyoNight',
  'tokyoNightDay', 'tokyoNightStorm', 'vscodeDark', 'vscodeLight', 'whitescreen', 'xcodeLight',
];

void main();
