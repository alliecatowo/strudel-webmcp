/** Takes tray: every clip captured from the live output, human- or tool-triggered. A take is a take. */
export interface Clip {
  id: string;
  label: string;
  blob: Blob;
  buffer: AudioBuffer;
  durationMs: number;
}

const MAX_CLIPS = 8;

export function createRecordingsTray(root: HTMLElement | null) {
  const urls = new Map<string, string>();
  return {
    add(clip: Clip): void {
      if (!root) return;
      root.hidden = false;
      root.parentElement?.removeAttribute('hidden');
      root.parentElement?.parentElement?.removeAttribute('hidden');
      const url = URL.createObjectURL(clip.blob);
      urls.set(clip.id, url);
      const ext = clip.blob.type.includes('ogg') ? 'ogg' : clip.blob.type.includes('mp4') ? 'm4a' : 'webm';

      const article = document.createElement('article');
      article.className = 'clip';
      article.dataset.clipId = clip.id;

      const head = document.createElement('div');
      head.className = 'clip-head';
      const title = document.createElement('span');
      title.className = 'clip-label';
      title.textContent = clip.label;
      const meta = document.createElement('span');
      meta.className = 'clip-meta';
      meta.textContent = `${(clip.durationMs / 1000).toFixed(1)} s`;
      const download = document.createElement('a');
      download.className = 'clip-download';
      download.href = url;
      download.download = `${safeName(clip.label)}.${ext}`;
      download.textContent = 'save';
      head.append(title, meta, download);

      const wave = document.createElement('canvas');
      wave.className = 'clip-wave';
      wave.width = 480;
      wave.height = 48;
      drawWaveform(wave, clip.buffer);

      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'metadata';
      audio.src = url;

      article.append(head, wave, audio);
      root.prepend(article);

      const clips = root.querySelectorAll<HTMLElement>('.clip');
      for (let i = MAX_CLIPS; i < clips.length; i++) {
        const old = clips[i];
        if (!old) continue;
        const id = old.dataset.clipId;
        const oldUrl = id ? urls.get(id) : undefined;
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        if (id) urls.delete(id);
        old.remove();
      }
    },
  };
}

function safeName(label: string): string {
  return label.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase() || 'strudel-take';
}

function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / width));
  ctx.clearRect(0, 0, width, height);
  // The editor's own accent token, so takes follow the active Strudel theme.
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--caret').trim() || '#ffcc00';
  const mid = height / 2;
  for (let x = 0; x < width; x++) {
    let min = 1;
    let max = -1;
    const start = x * step;
    for (let i = start; i < start + step && i < data.length; i++) {
      const v = data[i] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (max < min) continue;
    const top = mid - max * mid;
    const bottom = mid - min * mid;
    ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
}
