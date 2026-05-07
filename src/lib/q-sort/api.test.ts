import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishThought } from './api.js';

describe('publishThought', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('PUTs to the correct URL with the right headers and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ content: { path: 'src/content/thoughts/2026-05-07-0907.md' } }),
    } as unknown as Response);

    const result = await publishThought({
      fetch: fetchMock,
      pat: 'ghp_test',
      repo: 'tumluliu/blogs',
      filename: '2026-05-07-0907.md',
      contentBase64: 'aGVsbG8=',
      message: 'thought: 2026-05-07 09:07 via q-sort',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/tumluliu/blogs/contents/src/content/thoughts/2026-05-07-0907.md',
    );
    expect(init.method).toBe('PUT');
    expect(init.headers['Authorization']).toBe('Bearer ghp_test');
    expect(init.headers['Accept']).toBe('application/vnd.github+json');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      message: 'thought: 2026-05-07 09:07 via q-sort',
      content: 'aGVsbG8=',
      branch: 'master',
    });
    expect(result).toEqual({ ok: true, status: 201 });
  });

  it('returns { ok: false } with status and message on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Bad credentials' }),
    } as unknown as Response);

    const result = await publishThought({
      fetch: fetchMock,
      pat: 'bad',
      repo: 'tumluliu/blogs',
      filename: 'x.md',
      contentBase64: 'eA==',
      message: 'm',
    });

    expect(result).toEqual({ ok: false, status: 401, message: 'Bad credentials' });
  });

  it('returns { ok: false } with a network message on fetch rejection', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await publishThought({
      fetch: fetchMock,
      pat: 'p',
      repo: 'tumluliu/blogs',
      filename: 'x.md',
      contentBase64: 'eA==',
      message: 'm',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toMatch(/network/i);
  });
});
