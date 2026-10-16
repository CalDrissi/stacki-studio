import { previewHost } from '../../../vendor/stacki/electron/previewClient/morphAnchors';

interface PreviewHot {
  readonly on: (event: string, callback: (data: unknown) => void) => void;
  readonly send: (event: string, data: unknown) => void;
}

export function receiveRenderPush(hot: PreviewHot) {
  if (previewHost(location.hash) !== 'stacki') {
    return;
  }
  const path = location.pathname + location.search;
  let ready = false;
  const announce = () =>
    document.dispatchEvent(new CustomEvent('studio:render-push', { detail: ready }));
  hot.on('studio:render-ready', (data) => {
    if (matchesPage(data, path)) {
      ready = true;
      announce();
    }
  });
  hot.on('studio:render', (data) => {
    if (
      matchesPage(data, path) &&
      'html' in data &&
      typeof data.html === 'string' &&
      data.html.length <= 4_000_000
    ) {
      document.dispatchEvent(new CustomEvent('studio:render-html', { detail: data.html }));
    }
  });
  hot.on('studio:render-failed', (data) => {
    if (matchesPage(data, path)) {
      document.dispatchEvent(new Event('studio:render-fallback'));
    }
  });
  hot.on('vite:ws:disconnect', () => {
    ready = false;
    announce();
  });
  hot.on('vite:ws:connect', () => hot.send('studio:render-subscribe', { path }));
  document.addEventListener('studio:render-listening', announce);
  hot.send('studio:render-subscribe', { path });
}

function matchesPage(data: unknown, path: string): data is object & { path: string } {
  return !!data && typeof data === 'object' && 'path' in data && data.path === path;
}
