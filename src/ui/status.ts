import type { WebMcpStatus } from '../webmcp/register';

/** Tiny cosmetic status strip. Only reports WebMCP availability, never agent presence. */
export function renderWebMcpStatus(el: HTMLElement | null, status: WebMcpStatus): void {
  if (!el) return;
  switch (status.state) {
    case 'ready':
      el.dataset.state = 'ready';
      el.textContent = `WebMCP ready · ${status.toolCount} tools`;
      el.title = 'This page registers Strudel tools with document.modelContext.';
      break;
    case 'unavailable':
      el.dataset.state = 'unavailable';
      el.textContent = 'WebMCP unavailable';
      el.title = 'This browser does not expose document.modelContext. Strudel works normally.';
      break;
    case 'error':
      el.dataset.state = 'error';
      el.textContent = 'WebMCP error';
      el.title = status.message;
      break;
  }
}
