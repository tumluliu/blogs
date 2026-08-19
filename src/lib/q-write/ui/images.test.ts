import { describe, it, expect, vi } from 'vitest';
import { placeholder, replacePlaceholder, uploadImage, UploadRows, createSerialQueue, findUploadingPlaceholder } from './images.js';

const NOW = new Date(2026, 7, 19);
const auth = (fetchMock: unknown) => ({ fetch: fetchMock as typeof fetch, pat: 'ghp_test', repo: 'tumluliu/blogs' });
const blobOf = (bytes: number[]) => new Blob([new Uint8Array(bytes)]);
const fileOf = (name: string) => new File([new Uint8Array([1])], name, { type: 'image/png' });

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

describe('findUploadingPlaceholder', () => {
  it('finds the id of an unfinished upload left in the body', () => {
    const body = '开头\n\n![](uploading:img-3)\n\n结尾';
    expect(findUploadingPlaceholder(body)).toBe('img-3');
  });

  it('returns null once every placeholder has been replaced', () => {
    const body = '开头\n\n![](/media/2026/08/aa.webp)\n\n结尾';
    expect(findUploadingPlaceholder(body)).toBeNull();
  });

  it('returns null for an empty or plain body', () => {
    expect(findUploadingPlaceholder('')).toBeNull();
    expect(findUploadingPlaceholder('just text, no images')).toBeNull();
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

// Finding 1 (review round 1): a multi-file batch used to render one row at
// a time, replacing the whole strip on every call — so a second file's
// "compressing" row erased an earlier file's still-unresolved error row
// (and with it, that row's retry button). UploadRows is the fix: each file
// owns its row by id, independent of what any other id is doing.
describe('UploadRows', () => {
  it('keeps an earlier row visible when a later row is set (does not overwrite the whole strip)', () => {
    const rows = new UploadRows();
    rows.set('img-1', { label: 'img-1 · 上传失败 401', file: fileOf('a.png'), error: true });
    rows.set('img-2', { label: 'img-2 · 压缩中…', file: fileOf('b.png') });

    const ids = rows.list().map((r) => r.id);
    expect(ids).toEqual(['img-1', 'img-2']);
    expect(rows.list().find((r) => r.id === 'img-1')).toMatchObject({ error: true, label: 'img-1 · 上传失败 401' });
  });

  it('clear() removes only the named row, leaving the others', () => {
    const rows = new UploadRows();
    rows.set('img-1', { label: 'a', file: fileOf('a.png') });
    rows.set('img-2', { label: 'b', file: fileOf('b.png') });
    rows.clear('img-1');
    expect(rows.list().map((r) => r.id)).toEqual(['img-2']);
  });

  it('set() on an existing id updates that row in place without disturbing order or others', () => {
    const rows = new UploadRows();
    rows.set('img-1', { label: 'a · 压缩中…', file: fileOf('a.png') });
    rows.set('img-2', { label: 'b · 压缩中…', file: fileOf('b.png') });
    rows.set('img-1', { label: 'a · 上传中…', file: fileOf('a.png') });
    expect(rows.list().map((r) => [r.id, r.label])).toEqual([
      ['img-1', 'a · 上传中…'],
      ['img-2', 'b · 压缩中…'],
    ]);
  });
});

// Finding 3 (review round 1): change/paste/drop each fired handleFiles
// independently, so two triggers close together could run concurrently —
// racing the same content's getFile probe into two PUTs for one path.
// createSerialQueue is the fix, mirroring the promise-chain shape
// ui/state.ts's createAutosaver already uses for the same reason.
describe('createSerialQueue', () => {
  it('runs pushed items one at a time, in the order pushed, even when pushed before the first settles', async () => {
    const order: string[] = [];
    let releaseA: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const queue = createSerialQueue<string>(async (item) => {
      order.push(`start:${item}`);
      if (item === 'a') await gate;
      order.push(`end:${item}`);
    });

    const pA = queue.push('a');
    const pB = queue.push('b'); // fired before 'a' settles, like a paste right after a drop

    // Let pending microtasks run. If the queue did not serialize, 'b' would
    // already have started here — its worker has no gate holding it open.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['start:a']);

    releaseA();
    await pA;
    await pB;

    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('a later push still settles even when an earlier one throws', async () => {
    const order: string[] = [];
    const errors: unknown[] = [];
    const queue = createSerialQueue<string>(
      async (item) => {
        if (item === 'a') throw new Error('boom');
        order.push(item);
      },
      (err) => errors.push(err),
    );

    await queue.push('a');
    await queue.push('b');

    expect(order).toEqual(['b']);
    expect(errors).toHaveLength(1);
  });
});
