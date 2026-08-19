import { describe, it, expect, vi } from 'vitest';
import { draftFromRemote, docFromDraft, saveDraftToRepo } from './publish.js';
import { newDraft } from '../drafts.js';

const NOW = new Date(2026, 7, 19, 12, 0);
const auth = (fetchMock: unknown) => ({ fetch: fetchMock as typeof fetch, pat: 'ghp_test', repo: 'tumluliu/blogs' });

describe('draftFromRemote', () => {
  it('lifts title, tags and unknown frontmatter off a published post', () => {
    const raw = '---\ntitle: 老文\ntags:\n  - a\ndraft: false\nsource: cnblogs\nsourceUrl: https://x/y\n---\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/lao-wen.md', 'sha1', raw, NOW);
    expect(d).toMatchObject({
      title: '老文',
      slug: 'lao-wen',
      slugManual: true,
      tags: ['a'],
      body: '正文\n',
      remotePath: 'src/content/posts/lao-wen.md',
      remoteSha: 'sha1',
      state: 'published',
      hadFrontmatter: true,
    });
    expect(d.frontmatterExtra).toEqual({ source: 'cnblogs', sourceUrl: 'https://x/y' });
  });

  it('marks a draft:true post as synced, not published', () => {
    const d = draftFromRemote('id', 'src/content/posts/x.md', 's', '---\ndraft: true\n---\n\n正文\n', NOW);
    expect(d.state).toBe('synced');
  });

  it('takes the title from the H1 of a frontmatter-less legacy post', () => {
    const d = draftFromRemote('id', 'src/content/posts/x.md', 's', '# 老标题\n\n正文\n', NOW);
    expect(d.title).toBe('老标题');
    expect(d.hadFrontmatter).toBe(false);
    expect(d.body).toBe('# 老标题\n\n正文\n');
  });

  it('treats a file with malformed YAML frontmatter as body-only instead of throwing', () => {
    const raw = '---\ntitle: [unclosed\n---\n\n正文\n';
    let d: ReturnType<typeof draftFromRemote> | undefined;
    expect(() => {
      d = draftFromRemote('id', 'src/content/posts/broken.md', 's', raw, NOW);
    }).not.toThrow();
    expect(d?.hadFrontmatter).toBe(false);
    expect(d?.body).toBe(raw);
  });
});

describe('docFromDraft', () => {
  it('writes full frontmatter for a brand-new post', () => {
    const d = { ...newDraft('id', NOW), title: '新文', slug: 'xin-wen', tags: ['写作'], body: '正文' };
    const md = docFromDraft(d, { publish: false, now: NOW });
    expect(md).toContain('title: 新文');
    expect(md).toContain('slug: xin-wen');
    expect(md).toContain('draft: true');
    expect(md).toContain('source: original');
    expect(md).toMatch(/date: /);
    expect(md.endsWith('正文\n')).toBe(true);
  });

  it('flips draft to false when publishing', () => {
    const d = { ...newDraft('id', NOW), title: 'T', slug: 't', body: 'b' };
    expect(docFromDraft(d, { publish: true, now: NOW })).toContain('draft: false');
  });

  it('preserves unknown frontmatter and stamps updated when editing a published post', () => {
    const raw = '---\ntitle: 老文\ndate: 2020-01-01T00:00:00.000Z\nsource: cnblogs\n---\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/lao-wen.md', 'sha', raw, NOW);
    const md = docFromDraft({ ...d, body: '改过的正文' }, { publish: true, now: NOW });
    expect(md).toContain('source: cnblogs');
    expect(md).toContain('2020-01-01');   // original date survives
    expect(md).toMatch(/updated: /);
    expect(md.endsWith('改过的正文\n')).toBe(true);
  });

  it('does not inject a title into a legacy H1-only post', () => {
    const d = draftFromRemote('id', 'src/content/posts/x.md', 's', '# 老标题\n\n正文\n', NOW);
    const md = docFromDraft(d, { publish: true, now: NOW });
    expect(md).not.toContain('title:');
    expect(md).toContain('# 老标题');
  });

  it('rewrites the H1 when the title of a legacy post is edited', () => {
    const d = draftFromRemote('id', 'src/content/posts/x.md', 's', '# 老标题\n\n正文\n', NOW);
    const md = docFromDraft({ ...d, title: '新标题' }, { publish: true, now: NOW });
    expect(md).toContain('# 新标题');
    expect(md).not.toContain('老标题');
  });
});

describe('saveDraftToRepo', () => {
  it('PUTs a new post without a sha and records the returned sha', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ content: { sha: 'fresh' } }) });
    const d = { ...newDraft('id', NOW), title: 'T', slug: 't', body: 'b' };

    const out = await saveDraftToRepo(auth(fetchMock), d, { publish: false, now: NOW });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/contents/src/content/posts/t.md');
    expect(JSON.parse(init.body).sha).toBeUndefined();
    expect(JSON.parse(init.body).message).toBe('draft: t via q-write');
    expect(out.ok).toBe(true);
    expect(out.draft).toMatchObject({ state: 'synced', remoteSha: 'fresh', remotePath: 'src/content/posts/t.md' });
  });

  it('uses the publish commit message and published state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: { sha: 's2' } }) });
    const d = { ...newDraft('id', NOW), title: 'T', slug: 't', body: 'b' };
    const out = await saveDraftToRepo(auth(fetchMock), d, { publish: true, now: NOW });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).message).toBe('post: t via q-write');
    expect(out.draft.state).toBe('published');
  });

  it('flags a 409 as a conflict without mutating the draft state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ message: 'sha mismatch' }) });
    const d = { ...newDraft('id', NOW), title: 'T', slug: 't', body: 'b', remotePath: 'src/content/posts/t.md', remoteSha: 'old', state: 'synced' as const };
    const out = await saveDraftToRepo(auth(fetchMock), d, { publish: true, now: NOW });
    expect(out.conflict).toBe(true);
    expect(out.draft.state).toBe('synced');
    expect(out.draft.remoteSha).toBe('old');
  });

  it('renames by writing the new path then deleting the old one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ content: { sha: 'new' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const d = { ...newDraft('id', NOW), title: 'T', slug: 'new-slug', body: 'b', remotePath: 'src/content/posts/old-slug.md', remoteSha: 'old', state: 'synced' as const };

    const out = await saveDraftToRepo(auth(fetchMock), d, { publish: false, now: NOW });

    expect(fetchMock.mock.calls[0][0]).toContain('new-slug.md');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sha).toBeUndefined();
    expect(fetchMock.mock.calls[1][0]).toContain('old-slug.md');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(out.draft.remotePath).toBe('src/content/posts/new-slug.md');
    expect(out.ok).toBe(true);
  });

  it('still succeeds if deleting the old path fails after the new one is written', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ content: { sha: 'new' } }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ message: 'Not Found' }) });
    const d = { ...newDraft('id', NOW), title: 'T', slug: 'new-slug', body: 'b', remotePath: 'src/content/posts/old-slug.md', remoteSha: 'old', state: 'synced' as const };

    const out = await saveDraftToRepo(auth(fetchMock), d, { publish: false, now: NOW });

    expect(out.ok).toBe(true);
    expect(out.message).toMatch(/old-slug/);
  });
});
