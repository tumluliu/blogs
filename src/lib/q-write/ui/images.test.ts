import { describe, it, expect, vi } from 'vitest';
import { placeholder, replacePlaceholder, uploadImage } from './images.js';

const NOW = new Date(2026, 7, 19);
const auth = (fetchMock: unknown) => ({ fetch: fetchMock as typeof fetch, pat: 'ghp_test', repo: 'tumluliu/blogs' });
const blobOf = (bytes: number[]) => new Blob([new Uint8Array(bytes)]);

describe('placeholders', () => {
  it('builds a markdown image placeholder', () => {
    expect(placeholder('img-1')).toBe('![](uploading:img-1)');
  });

  it('replaces exactly that placeholder and leaves others alone', () => {
    const body = 'a\n![](uploading:img-1)\nb\n![](uploading:img-2)\n';
    const out = replacePlaceholder(body, 'img-1', '![](/media/2026/08/aa.webp)');
    expect(out).toContain('![](/media/2026/08/aa.webp)');
    expect(out).toContain('![](uploading:img-2)');
  });

  it('is a no-op when the placeholder was already deleted by the user', () => {
    expect(replacePlaceholder('body only', 'img-1', 'x')).toBe('body only');
  });
});

describe('uploadImage', () => {
  it('skips the PUT when the hashed file already exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ path: 'p', sha: 's', content: '' }),
    });

    const res = await uploadImage(auth(fetchMock), blobOf([1, 2, 3]), 'webp', NOW);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe(true);
    expect(res.url).toMatch(/^\/media\/2026\/08\/[0-9a-f]{8}\.webp$/);
  });

  it('PUTs the bytes when the file is absent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ content: { sha: 'x' } }) });

    const res = await uploadImage(auth(fetchMock), blobOf([1, 2, 3]), 'webp', NOW);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toMatch(/\/contents\/public\/media\/2026\/08\/[0-9a-f]{8}\.webp$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).content.length).toBeGreaterThan(0);
    expect(res.ok).toBe(true);
    expect(res.skipped).toBeFalsy();
  });

  it('gives the same URL for identical bytes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ path: 'p', sha: 's', content: '' }) });
    const a = await uploadImage(auth(fetchMock), blobOf([7, 7, 7]), 'webp', NOW);
    const b = await uploadImage(auth(fetchMock), blobOf([7, 7, 7]), 'webp', NOW);
    expect(a.url).toBe(b.url);
  });

  it('rejects a blob larger than 5MB without any request', async () => {
    const fetchMock = vi.fn();
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    const res = await uploadImage(auth(fetchMock), big, 'webp', NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/5MB/);
  });

  it('reports a failed PUT', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Bad credentials' }) });
    const res = await uploadImage(auth(fetchMock), blobOf([1]), 'webp', NOW);
    expect(res).toMatchObject({ ok: false, status: 401 });
  });
});
