import type { WebMcpStatus } from '../webmcp/register';
import { ACTIVITY_EVENT, type ActivityDetail } from '../webmcp/results';

/** Tiny cosmetic status strip. Only reports WebMCP availability and our own tool activity, never agent presence. */
export function renderWebMcpStatus(el: HTMLElement | null, status: WebMcpStatus): void {
  if (!el) return;
  const label = el.querySelector<HTMLElement>('.status-label') ?? el;
  switch (status.state) {
    case 'ready':
      el.dataset.state = 'ready';
      label.textContent = `WebMCP ready · ${status.toolCount} tools`;
      el.title = 'This page registers Strudel tools with document.modelContext.';
      break;
    case 'unavailable':
      el.dataset.state = 'unavailable';
      label.textContent = 'WebMCP unavailable';
      el.title = 'This browser does not expose document.modelContext. Strudel works normally.';
      break;
    case 'error':
      el.dataset.state = 'error';
      label.textContent = 'WebMCP error';
      el.title = status.message;
      break;
  }
}

/** Show "· apply_edits ✓" for a few seconds after each tool call, with a small pulse. */
export function wireActivityIndicator(el: HTMLElement | null): void {
  if (!el) return;
  const activity = el.querySelector<HTMLElement>('.status-activity');
  if (!activity) return;
  let timer: number | undefined;
  document.addEventListener(ACTIVITY_EVENT, (ev) => {
    const d = (ev as CustomEvent<ActivityDetail>).detail;
    const name = d.tool.replace(/^strudel_/, '');
    activity.textContent = `· ${name} ${d.ok ? '✓' : `✕ ${d.error ?? ''}`.trim()}`;
    activity.dataset.ok = String(d.ok);
    activity.classList.remove('pulse');
    void activity.offsetWidth; // restart the animation
    activity.classList.add('pulse', 'visible');
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => activity.classList.remove('visible'), 4000);
  });
}
