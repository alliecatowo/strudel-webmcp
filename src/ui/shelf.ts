import type { Session, Snapshot, LoadedSample } from '../strudel/session';
import type { StrudelAdapter } from '../strudel/types';
import { strudelCcUrl } from '../strudel/share';

/** Versions and Samples sections of the shelf, rendered from session state. */
export function wireShelf(session: Session, adapter: StrudelAdapter): void {
  const shelf = document.getElementById('shelf');
  const takes = document.getElementById('shelf-takes');
  const versionsSection = document.getElementById('shelf-versions');
  const versions = document.getElementById('versions');
  const samplesSection = document.getElementById('shelf-samples');
  const samples = document.getElementById('samples');

  const render = () => {
    const st = session.state;
    if (versions && versionsSection) {
      versionsSection.hidden = st.snapshots.length === 0;
      versions.replaceChildren(...st.snapshots.map((s) => versionCard(s, adapter, session)));
    }
    if (samples && samplesSection) {
      samplesSection.hidden = st.samples.length === 0;
      samples.replaceChildren(...st.samples.map(sampleChip));
    }
    if (shelf) shelf.hidden = Boolean(versionsSection?.hidden && samplesSection?.hidden && takes?.hidden);
  };
  session.addEventListener('change', render);
  // Takes are appended by the recordings tray; watch for it un-hiding.
  if (takes) new MutationObserver(render).observe(takes, { attributes: true, attributeFilter: ['hidden'] });
  render();
}

function versionCard(s: Snapshot, adapter: StrudelAdapter, session: Session): HTMLElement {
  const el = document.createElement('article');
  el.className = 'version';
  el.dataset.snapshotId = s.id;
  const head = document.createElement('div');
  head.className = 'version-head';
  const label = document.createElement('span');
  label.className = 'version-label';
  label.textContent = s.label;
  const meta = document.createElement('span');
  meta.className = 'version-meta';
  meta.textContent = new Date(s.createdAt).toLocaleTimeString();
  head.append(label, meta);
  const actions = document.createElement('div');
  actions.className = 'version-actions';
  const restore = button('Restore', () => adapter.restoreSnapshot(s.id));
  const download = document.createElement('a');
  download.className = 'link';
  download.textContent = 'Export';
  download.href = URL.createObjectURL(new Blob([s.code], { type: 'text/plain' }));
  download.download = `${s.label.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'strudel'}.strudel`;
  const open = document.createElement('a');
  open.className = 'link';
  open.textContent = 'Open in strudel.cc';
  open.href = strudelCcUrl(s.code);
  open.target = '_blank';
  open.rel = 'noopener';
  const remove = button('Remove', () => session.removeSnapshot(s.id));
  actions.append(restore, download, open, remove);
  el.append(head, actions);
  return el;
}

function sampleChip(s: LoadedSample): HTMLElement {
  const el = document.createElement('code');
  el.className = 'sample-chip';
  el.title = `${s.source === 'human' ? 'Added by you' : 'Added by the agent'} · use s("${s.name}")`;
  el.textContent = s.name;
  return el;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'link';
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}
