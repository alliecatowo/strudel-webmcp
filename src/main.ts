// Strudel WebMCP: the normal Strudel REPL, progressively enhanced with WebMCP tools.
// Copyright (C) 2026 Allison Coleman. AGPL-3.0-only. See LICENSE.
import '@strudel/repl';
import { DEMO_PATTERN } from './demo-pattern';
import { createStrudelAdapter } from './strudel/adapter';
import type { StrudelEditorElement } from './strudel/host';
import { registerStrudelTools } from './webmcp/register';
import { renderWebMcpStatus } from './ui/status';

function mountRepl(): StrudelEditorElement {
  const mount = document.getElementById('repl-mount');
  if (!mount) throw new Error('missing #repl-mount');
  const host = document.createElement('strudel-editor') as StrudelEditorElement;
  host.setAttribute('code', DEMO_PATTERN);
  mount.append(host);
  return host;
}

function wireTransport(host: StrudelEditorElement): void {
  const play = document.getElementById('btn-play') as HTMLButtonElement | null;
  const update = document.getElementById('btn-update') as HTMLButtonElement | null;
  // Native REPL paths only: toggle() = evaluate when stopped / stop when playing.
  play?.addEventListener('click', () => void host.editor?.toggle());
  update?.addEventListener('click', () => void host.editor?.evaluate());
  const errorBox = document.getElementById('eval-error');
  host.addEventListener('update', (ev) => {
    const detail = (ev as CustomEvent<{ started?: boolean; error?: Error }>).detail;
    const started = Boolean(detail?.started);
    if (play) {
      play.dataset.playing = String(started);
      play.textContent = started ? '■ Stop' : '▶ Play';
    }
    // Human and agent see the same failure: mirror the REPL's own error state, nothing more.
    if (errorBox) {
      const message = detail?.error?.message;
      errorBox.hidden = !message;
      errorBox.textContent = message ? `Error: ${message}` : '';
    }
  });
}

async function main(): Promise<void> {
  await customElements.whenDefined('strudel-editor');
  const host = mountRepl();
  wireTransport(host);

  const adapter = createStrudelAdapter(host);
  const { status } = await registerStrudelTools(adapter);
  renderWebMcpStatus(document.getElementById('webmcp-status'), status);
}

void main();
