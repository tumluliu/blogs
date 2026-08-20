// Exercises public/sw-q-write.js's navigation-request handling for real,
// by evaluating the actual worker source with mocked self/caches/fetch,
// rather than re-implementing its logic and asserting against the copy.
//
// Regression target: a non-ok origin response (a transient 5xx, or a 404
// from a botched deploy) must not be handed straight to the browser when a
// good cached shell exists — the network-first navigation path has to fall
// back to the cache the same way the offline (fetch-rejects) path already
// does, and only let the error response through when nothing is cached.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CACHE = 'qwrite-v1';
const PAGE_URL = 'http://localhost/q-write/';

type FakeResponse = { ok: boolean; status: number; body: string; clone: () => FakeResponse };

function fakeResponse(ok: boolean, status: number, body: string): FakeResponse {
  return { ok, status, body, clone: () => fakeResponse(ok, status, body) };
}

// A minimal in-memory stand-in for the real CacheStorage/Cache APIs, keyed
// by request URL (string) the same way the worker uses them.
function createFakeCaches(seed: Record<string, Record<string, FakeResponse>> = {}) {
  const stores = new Map<string, Map<string, FakeResponse>>();
  for (const [cacheName, entries] of Object.entries(seed)) {
    stores.set(cacheName, new Map(Object.entries(entries)));
  }
  const urlOf = (reqOrUrl: string | { url: string }) =>
    typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url;

  return {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        put: async (req: { url: string }, res: FakeResponse) => {
          store.set(urlOf(req), res);
        },
      };
    },
    match: async (req: string | { url: string }) => {
      for (const store of stores.values()) {
        const hit = store.get(urlOf(req));
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => Array.from(stores.keys()),
    delete: async () => true,
  };
}

// Loads public/sw-q-write.js by evaluating its actual source against
// injected self/caches/fetch, and returns the captured 'fetch' listener.
function loadFetchHandler(cachesImpl: ReturnType<typeof createFakeCaches>, fetchImpl: (req: unknown) => Promise<FakeResponse>) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const fakeSelf = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
    location: { origin: 'http://localhost' },
  };
  const source = readFileSync(resolve('public/sw-q-write.js'), 'utf-8');
  // eslint-disable-next-line no-new-func -- deliberately evaluating the real worker source
  const install = new Function('self', 'caches', 'fetch', source);
  install(fakeSelf, cachesImpl, fetchImpl);
  const handler = listeners.fetch;
  if (!handler) throw new Error('worker never registered a fetch listener');
  return handler;
}

function fireNavigation(handler: (event: unknown) => void, url: string) {
  let captured: unknown;
  handler({
    request: { method: 'GET', url, mode: 'navigate' },
    respondWith: (value: unknown) => {
      captured = value;
    },
  });
  return captured as Promise<FakeResponse>;
}

describe('sw-q-write.js navigation fetch handling', () => {
  it('falls back to the cached shell when the origin responds non-ok', async () => {
    const cached = fakeResponse(true, 200, 'CACHED-SHELL');
    const cachesImpl = createFakeCaches({ [CACHE]: { [PAGE_URL]: cached } });
    const handler = loadFetchHandler(cachesImpl, async () => fakeResponse(false, 502, 'BAD-GATEWAY'));

    const result = await fireNavigation(handler, PAGE_URL);

    expect(result.body).toBe('CACHED-SHELL');
  });

  it('lets the non-ok response through when nothing is cached', async () => {
    const cachesImpl = createFakeCaches();
    const handler = loadFetchHandler(cachesImpl, async () => fakeResponse(false, 500, 'ORIGIN-ERROR'));

    const result = await fireNavigation(handler, PAGE_URL);

    expect(result.body).toBe('ORIGIN-ERROR');
    expect(result.ok).toBe(false);
  });

  it('still falls back to the cache on a genuine network failure (offline)', async () => {
    const cached = fakeResponse(true, 200, 'CACHED-SHELL');
    const cachesImpl = createFakeCaches({ [CACHE]: { [PAGE_URL]: cached } });
    const handler = loadFetchHandler(cachesImpl, async () => {
      throw new TypeError('Failed to fetch');
    });

    const result = await fireNavigation(handler, PAGE_URL);

    expect(result.body).toBe('CACHED-SHELL');
  });

  it('returns the fresh response on a normal ok fetch, not the cache', async () => {
    const cached = fakeResponse(true, 200, 'STALE-CACHED-SHELL');
    const cachesImpl = createFakeCaches({ [CACHE]: { [PAGE_URL]: cached } });
    const handler = loadFetchHandler(cachesImpl, async () => fakeResponse(true, 200, 'FRESH-SHELL'));

    const result = await fireNavigation(handler, PAGE_URL);

    expect(result.body).toBe('FRESH-SHELL');
  });
});
