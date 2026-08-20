import { describe, it, expect, vi } from 'vitest';
import { draftFromRemote, docFromDraft, saveDraftToRepo, preflightCommit, renamePlan } from './publish.js';
import { newDraft } from '../drafts.js';
import { base64ToUtf8 } from '../../gh/encoding.js';

const NOW = new Date(2026, 7, 19, 12, 0);
const auth = (fetchMock: unknown) => ({ fetch: fetchMock as typeof fetch, pat: 'ghp_test', repo: 'tumluliu/blogs' });

// The markdown actually handed to the Contents API on the i-th call.
const written = (fetchMock: { mock: { calls: [string, { body: string }][] } }, i: number): string =>
  base64ToUtf8(JSON.parse(fetchMock.mock.calls[i][1].body).content as string);

const fmValue = (md: string, key: string): string | undefined =>
  md.match(new RegExp(`^${key}: (.*)$`, 'm'))?.[1];

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
    // `title` rides along too: where the title lives is a property of the
    // document, and only the original `title:` key can answer that.
    expect(d.frontmatterExtra).toEqual({ title: '老文', source: 'cnblogs', sourceUrl: 'https://x/y' });
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
    expect(d?.body).toBe('正文\n');
  });

  it('strips the unparseable leading fence so a resave cannot wrap a fresh frontmatter block around it', () => {
    const raw = '---\ntitle: [unclosed\n---\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/broken.md', 's', raw, NOW);

    // (a) the stored body carries no leading `---` fence.
    expect(d.body.startsWith('---')).toBe(false);

    // (b) round-tripping through docFromDraft must produce exactly one
    // frontmatter block — an orphaned old fence left in the body would show
    // up as a second `---`/`---` pair once a new header is serialized.
    const md = docFromDraft({ ...d, tags: ['x'] }, { publish: false, now: NOW });
    const fenceLines = md.match(/^---$/gm) ?? [];
    expect(fenceLines.length).toBe(2);
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

  it('keeps both the frontmatter title and a differing body H1 on an untouched round-trip', () => {
    const raw = '---\ntitle: 空间记忆\ndate: 2020-01-01T00:00:00.000Z\n---\n\n# 空间记忆：另一个写法的大标题\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/kong-jian-ji-yi.md', 'sha', raw, NOW);
    expect(d.title).toBe('空间记忆');

    const md = docFromDraft(d, { publish: true, now: NOW });

    expect(fmValue(md, 'title')).toBe('空间记忆');
    expect(md).toContain('# 空间记忆：另一个写法的大标题');
  });

  it('edits the frontmatter title, not the H1, when the post carries both', () => {
    const raw = '---\ntitle: 空间记忆\n---\n\n# 空间记忆：另一个写法的大标题\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/kong-jian-ji-yi.md', 'sha', raw, NOW);
    const md = docFromDraft({ ...d, title: '新标题' }, { publish: true, now: NOW });
    expect(fmValue(md, 'title')).toBe('新标题');
    expect(md).toContain('# 空间记忆：另一个写法的大标题');
  });

  it('keeps a live post live when it is only checkpointed to the repo', () => {
    const raw = '---\ntitle: 老文\ndate: 2020-01-01T00:00:00.000Z\ndraft: false\n---\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/lao-wen.md', 'sha', raw, NOW);
    expect(d.state).toBe('published');

    // 存到仓库, not 发布 — a checkpoint must not retract a published post.
    const md = docFromDraft({ ...d, body: '改到一半的正文' }, { publish: false, now: NOW });

    expect(md).toContain('draft: false');
    expect(md).not.toContain('draft: true');
  });

  it('still checkpoints an unpublished repo draft as draft: true', () => {
    const raw = '---\ntitle: 半成品\ndraft: true\n---\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/ban-cheng-pin.md', 'sha', raw, NOW);
    expect(docFromDraft(d, { publish: false, now: NOW })).toContain('draft: true');
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

  it('folds the frontmatter it wrote back into the draft so a second save keeps date', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ content: { sha: 'sha1' } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: { sha: 'sha2' } }) });
    const d = { ...newDraft('id', NOW), title: '新文', slug: 'xin-wen', tags: ['写作'], body: '正文' };

    // The canonical flow: 存到仓库, keep writing, 发布.
    const first = await saveDraftToRepo(auth(fetchMock), d, { publish: false, now: NOW });
    const later = new Date(2026, 8, 1, 9, 30);
    const second = await saveDraftToRepo(
      auth(fetchMock),
      { ...first.draft, body: '正文，又写了一段' },
      { publish: true, now: later },
    );

    const a = written(fetchMock, 0);
    const b = written(fetchMock, 1);

    // `date` is stamped once and never rewritten: without it the content
    // loader falls back to the file's mtime, which the deploy runner's
    // checkout resets — the post would be re-dated to "today" forever.
    expect(fmValue(a, 'date')).toBeDefined();
    expect(fmValue(b, 'date')).toBe(fmValue(a, 'date'));
    expect(fmValue(b, 'date')).not.toContain('2026-09');

    expect(fmValue(b, 'source')).toBe('original');
    expect(fmValue(b, 'slug')).toBe('xin-wen');
    expect(fmValue(b, 'title')).toBe('新文');
    expect(fmValue(b, 'updated')).toBeDefined();
    expect(second.draft.frontmatterExtra.date).toBe(NOW.toISOString());
    expect(second.ok).toBe(true);
  });

  it('keeps a checkpointed published post in the published state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: { sha: 's' } }) });
    const raw = '---\ntitle: 老文\ndate: 2020-01-01T00:00:00.000Z\ndraft: false\n---\n\n正文\n';
    const d = draftFromRemote('id', 'src/content/posts/lao-wen.md', 'sha', raw, NOW);

    const first = await saveDraftToRepo(auth(fetchMock), d, { publish: false, now: NOW });
    expect(first.draft.state).toBe('published');

    // A second checkpoint must not find a downgraded state and retract it.
    await saveDraftToRepo(auth(fetchMock), first.draft, { publish: false, now: NOW });
    expect(written(fetchMock, 0)).toContain('draft: false');
    expect(written(fetchMock, 1)).toContain('draft: false');
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

describe('preflightCommit', () => {
  it('refuses a draft with no slug', () => {
    const d = { ...newDraft('id', NOW), slug: '', body: '正文' };
    const out = preflightCommit(d);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe('no-slug');
      expect(out.message).toBe('先写标题（或手动填 slug）');
    }
  });

  it('refuses a draft whose body still carries an unfinished upload placeholder', () => {
    const d = { ...newDraft('id', NOW), slug: 't', body: '开头\n\n![](uploading:img-2)\n\n结尾' };
    const out = preflightCommit(d);
    expect(out.ok).toBe(false);
    if (out.ok || out.reason !== 'uploading') throw new Error('expected an uploading refusal');
    expect(out.uploadId).toBe('img-2');
    expect(out.message).toContain('img-2');
  });

  it('passes a draft with a slug and no unfinished upload', () => {
    const d = { ...newDraft('id', NOW), slug: 't', body: '正文，没有占位符' };
    expect(preflightCommit(d)).toEqual({ ok: true });
  });

  it('reports the no-slug refusal even when an upload placeholder is also present', () => {
    const d = { ...newDraft('id', NOW), slug: '', body: '![](uploading:img-9)' };
    const out = preflightCommit(d);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('no-slug');
  });
});

describe('renamePlan', () => {
  it('does not rename a draft that has never been saved to the repo', () => {
    const d = { ...newDraft('id', NOW), slug: 'xin-wen' };
    expect(renamePlan(d)).toEqual({ renames: false });
  });

  it('does not rename when the slug still matches the remote path', () => {
    const d = { ...newDraft('id', NOW), slug: 't', remotePath: 'src/content/posts/t.md' };
    expect(renamePlan(d)).toEqual({ renames: false });
  });

  it('names the file that would be deleted and says the move is not a copy', () => {
    const d = { ...newDraft('id', NOW), slug: 'new-slug', remotePath: 'src/content/posts/old-slug.md' };
    const plan = renamePlan(d);
    if (!plan.renames) throw new Error('expected a rename');
    expect(plan.from).toBe('src/content/posts/old-slug.md');
    expect(plan.to).toBe('src/content/posts/new-slug.md');
    // the old path has to be named, and the prompt must not promise a copy
    expect(plan.message).toContain('src/content/posts/old-slug.md');
    expect(plan.message).toContain('不是复制');
    expect(plan.message).not.toContain('另存为新文件');
  });
});
