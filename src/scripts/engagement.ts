// Wires up the .engagement block on each post page:
// - Fetches stats + fires a single view increment on load.
// - Handles Like clicks with localStorage dedup + optimistic UI.
// - Handles Share via navigator.share() with clipboard fallback.
//
// Module-level entry point at end runs automatically once DOM is ready.
// Exported wireEngagement(deps) is used in unit tests with a mocked fetch.

interface Deps {
  fetch: typeof fetch;
}

export async function wireEngagement(deps: Deps): Promise<void> {
  const root = document.querySelector<HTMLElement>('.engagement');
  if (!root) return;
  const slug = root.dataset.slug;
  if (!slug) return;

  const viewsEl = root.querySelector<HTMLElement>('.views')!;
  const likeBtn = root.querySelector<HTMLButtonElement>('.like-btn')!;
  const likeCount = root.querySelector<HTMLElement>('.like-btn .count')!;
  const shareBtn = root.querySelector<HTMLButtonElement>('.share-btn')!;
  const toast = root.querySelector<HTMLElement>('.toast')!;

  const alreadyLiked = readLikedFlag(slug);
  if (alreadyLiked) {
    likeBtn.setAttribute('aria-pressed', 'true');
  }

  // Hydrate from /api/stats then fire view.
  try {
    const r = await deps.fetch(`/api/stats/${encodeURIComponent(slug)}`);
    if (r.ok) {
      const { views, likes } = await r.json();
      renderViews(viewsEl, views);
      renderLikes(likeCount, likes);
    }
  } catch (err) {
    console.warn('stats fetch failed', err);
  }

  try {
    const r = await deps.fetch(`/api/view/${encodeURIComponent(slug)}`, { method: 'POST' });
    if (r.ok) {
      const { views } = await r.json();
      if (typeof views === 'number') renderViews(viewsEl, views);
    }
  } catch (err) {
    console.warn('view post failed', err);
  }

  likeBtn.addEventListener('click', async () => {
    if (likeBtn.getAttribute('aria-pressed') === 'true') return;
    const prevCount = parseLikeCount(likeCount.textContent);
    likeBtn.setAttribute('aria-pressed', 'true');
    likeCount.textContent = String(prevCount + 1);
    writeLikedFlag(slug);
    try {
      const r = await deps.fetch(`/api/like/${encodeURIComponent(slug)}`, { method: 'POST' });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const { likes } = await r.json();
      if (typeof likes === 'number') renderLikes(likeCount, likes);
    } catch (err) {
      console.warn('like post failed', err);
      likeBtn.setAttribute('aria-pressed', 'false');
      likeCount.textContent = String(prevCount);
      clearLikedFlag(slug);
      showToast(toast, '稍后再试');
    }
  });

  shareBtn.addEventListener('click', async () => {
    const url = location.href;
    const title = document.title;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // user cancellation throws AbortError; treat as no-op
        if ((err as Error)?.name !== 'AbortError') console.warn('share failed', err);
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(toast, '已复制链接');
    } catch (err) {
      console.warn('clipboard failed', err);
    }
  });
}

function renderViews(el: HTMLElement, n: number): void {
  el.textContent = `${n.toLocaleString()} 次阅读`;
}
function renderLikes(el: HTMLElement, n: number): void {
  el.textContent = String(n);
}
function parseLikeCount(text: string | null): number {
  const n = parseInt((text ?? '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function readLikedFlag(slug: string): boolean {
  try {
    return localStorage.getItem(`liked:${slug}`) === '1';
  } catch {
    return false;
  }
}
function writeLikedFlag(slug: string): void {
  try {
    localStorage.setItem(`liked:${slug}`, '1');
  } catch {
    /* private mode etc. — server dedup absorbs */
  }
}
function clearLikedFlag(slug: string): void {
  try {
    localStorage.removeItem(`liked:${slug}`);
  } catch {
    /* ignore */
  }
}
function showToast(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

// Auto-run on the live page only.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const start = () => wireEngagement({ fetch: window.fetch.bind(window) });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
