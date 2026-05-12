// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireEngagement } from './engagement';

function mountDom(slug = 'test-slug') {
  document.body.innerHTML = `
    <aside class="engagement" data-slug="${slug}">
      <div class="stats">
        <span class="views">— 次阅读</span>
        <span class="words">100 字</span>
      </div>
      <div class="actions">
        <button class="like-btn" aria-pressed="false" type="button">
          <span aria-hidden="true">♡</span> <span class="count">—</span>
        </button>
        <button class="share-btn" type="button">分享</button>
      </div>
      <div class="toast" aria-live="polite"></div>
    </aside>
  `;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('wireEngagement', () => {
  it('hydrates stats and fires one view increment', async () => {
    mountDom();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ views: 7, likes: 3 })) // GET stats
      .mockResolvedValueOnce(jsonResp({ views: 8 }));          // POST view
    await wireEngagement({ fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/stats\/test-slug$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/view\/test-slug$/);
    expect(document.querySelector('.views')!.textContent).toContain('8');
    expect(document.querySelector('.like-btn .count')!.textContent).toBe('3');
  });

  it('keeps stats unchanged when API unreachable', async () => {
    mountDom();
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    await wireEngagement({ fetch: fetchMock });
    expect(document.querySelector('.views')!.textContent).toContain('—');
  });

  it('disables like button when localStorage flag is set', async () => {
    localStorage.setItem('liked:test-slug', '1');
    mountDom();
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ views: 0, likes: 5 }));
    await wireEngagement({ fetch: fetchMock });
    const btn = document.querySelector<HTMLButtonElement>('.like-btn')!;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('like click persists to localStorage on 2xx', async () => {
    mountDom();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ views: 0, likes: 0 })) // GET stats
      .mockResolvedValueOnce(jsonResp({ views: 1 }))           // POST view
      .mockResolvedValueOnce(jsonResp({ likes: 1 }));          // POST like
    await wireEngagement({ fetch: fetchMock });
    const btn = document.querySelector<HTMLButtonElement>('.like-btn')!;
    btn.click();
    await flush();
    expect(localStorage.getItem('liked:test-slug')).toBe('1');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.like-btn .count')!.textContent).toBe('1');
  });

  it('reverts like state on 5xx', async () => {
    mountDom();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ views: 0, likes: 0 }))
      .mockResolvedValueOnce(jsonResp({ views: 1 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    await wireEngagement({ fetch: fetchMock });
    document.querySelector<HTMLButtonElement>('.like-btn')!.click();
    await flush();
    expect(localStorage.getItem('liked:test-slug')).toBeNull();
    expect(
      document.querySelector<HTMLButtonElement>('.like-btn')!.getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('share uses navigator.share when present', async () => {
    mountDom();
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ views: 0, likes: 0 }));
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    await wireEngagement({ fetch: fetchMock });
    document.querySelector<HTMLButtonElement>('.share-btn')!.click();
    await flush();
    expect(shareSpy).toHaveBeenCalled();
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('share falls back to clipboard when navigator.share missing', async () => {
    mountDom();
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ views: 0, likes: 0 }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await wireEngagement({ fetch: fetchMock });
    document.querySelector<HTMLButtonElement>('.share-btn')!.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith(location.href);
  });
});

function jsonResp(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
