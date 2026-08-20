import { describe, it, expect, vi } from 'vitest';
import { getFile, putFile, deleteFile, listDir } from './client.js';

const auth = (fetchMock: unknown) => ({
  fetch: fetchMock as typeof fetch,
  pat: 'ghp_test',
  repo: 'tumluliu/blogs',
});

describe('putFile', () => {
  it('PUTs base64 content to the contents API on master', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ content: { sha: 'newsha' } }),
    });

    const res = await putFile(auth(fetchMock), {
      path: 'src/content/posts/foo.md',
      contentBase64: 'aGVsbG8=',
      message: 'post: foo via q-write',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/tumluliu/blogs/contents/src/content/posts/foo.md');
    expect(init.method).toBe('PUT');
    expect(init.headers['Authorization']).toBe('Bearer ghp_test');
    expect(init.headers['Accept']).toBe('application/vnd.github+json');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    expect(JSON.parse(init.body)).toEqual({
      message: 'post: foo via q-write',
      content: 'aGVsbG8=',
      branch: 'master',
    });
    expect(res).toEqual({ ok: true, status: 201, data: { sha: 'newsha' } });
  });

  it('includes sha when updating an existing file', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: { sha: 'sha2' } }),
    });

    await putFile(auth(fetchMock), {
      path: 'p.md',
      contentBase64: 'eA==',
      message: 'm',
      sha: 'sha1',
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sha).toBe('sha1');
  });

  it('surfaces GitHub error messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'is at abc but expected def' }),
    });

    const res = await putFile(auth(fetchMock), { path: 'p.md', contentBase64: 'eA==', message: 'm' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
    expect(res.message).toMatch(/expected/);
  });

  it('reports network failure as status 0', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await putFile(auth(fetchMock), { path: 'p.md', contentBase64: 'eA==', message: 'm' });
    expect(res.status).toBe(0);
    expect(res.message).toMatch(/network/i);
  });
});

describe('getFile', () => {
  it('decodes base64 content and returns the sha', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        path: 'src/content/posts/foo.md',
        sha: 'abc',
        content: Buffer.from('# 标题\n\n正文', 'utf-8').toString('base64'),
      }),
    });

    const res = await getFile(auth(fetchMock), 'src/content/posts/foo.md');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(res.data).toEqual({ path: 'src/content/posts/foo.md', sha: 'abc', text: '# 标题\n\n正文' });
  });

  it('returns ok:false with status 404 for a missing file', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });
    const res = await getFile(auth(fetchMock), 'nope.md');
    expect(res).toMatchObject({ ok: false, status: 404 });
  });
});

describe('listDir', () => {
  it('maps entries to name/path/sha and drops directories', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { type: 'file', name: 'a.md', path: 'src/content/posts/a.md', sha: 's1' },
        { type: 'dir', name: 'sub', path: 'src/content/posts/sub', sha: 's2' },
      ],
    });

    const res = await listDir(auth(fetchMock), 'src/content/posts');
    expect(res.data).toEqual([{ name: 'a.md', path: 'src/content/posts/a.md', sha: 's1' }]);
  });
});

describe('deleteFile', () => {
  it('DELETEs with sha and message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await deleteFile(auth(fetchMock), { path: 'old.md', sha: 's', message: 'chore: rename' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ message: 'chore: rename', sha: 's', branch: 'master' });
  });
});
