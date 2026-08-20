import { describe, it, expect } from 'vitest';
import { parseDoc, serializeDoc, docTitle, setDocTitle, patchMeta } from './frontmatter.js';

describe('parseDoc', () => {
  it('splits frontmatter from body', () => {
    const doc = parseDoc('---\ntitle: Foo\ntags: [a]\n---\n\n正文\n');
    expect(doc.hadFrontmatter).toBe(true);
    expect(doc.fm).toEqual({ title: 'Foo', tags: ['a'] });
    expect(doc.body).toBe('正文\n');
  });

  it('treats a file with no frontmatter as body-only', () => {
    const doc = parseDoc('# 标题\n\n正文\n');
    expect(doc.hadFrontmatter).toBe(false);
    expect(doc.fm).toEqual({});
    expect(doc.body).toBe('# 标题\n\n正文\n');
  });
});

describe('serializeDoc', () => {
  it('emits no frontmatter block when there is nothing to emit', () => {
    const doc = { fm: {}, hadFrontmatter: false, body: '# 标题\n' };
    expect(serializeDoc(doc)).toBe('# 标题\n');
  });

  it('round-trips unknown keys untouched', () => {
    const raw = '---\ntitle: Foo\nsource: cnblogs\nsourceUrl: https://example.com/a\n---\n\n正文\n';
    const out = serializeDoc(parseDoc(raw));
    expect(out).toContain('source: cnblogs');
    expect(out).toContain('sourceUrl: https://example.com/a');
    expect(out.endsWith('正文\n')).toBe(true);
  });

  it('always ends the body with exactly one newline', () => {
    expect(serializeDoc({ fm: {}, hadFrontmatter: false, body: 'x' })).toBe('x\n');
    expect(serializeDoc({ fm: {}, hadFrontmatter: false, body: 'x\n\n\n' })).toBe('x\n');
  });
});

describe('docTitle', () => {
  it('prefers the frontmatter title', () => {
    const doc = parseDoc('---\ntitle: FM 标题\n---\n\n# H1 标题\n');
    expect(docTitle(doc)).toEqual({ title: 'FM 标题', source: 'fm' });
  });

  it('falls back to the first H1', () => {
    const doc = parseDoc('# H1 标题\n\n正文\n');
    expect(docTitle(doc)).toEqual({ title: 'H1 标题', source: 'h1' });
  });

  it('reports none when there is neither', () => {
    expect(docTitle(parseDoc('正文\n'))).toEqual({ title: '', source: 'none' });
  });
});

describe('setDocTitle', () => {
  it('always writes fm.title, even when the body opens with an H1', () => {
    const doc = setDocTitle(parseDoc('# 旧标题\n\n正文\n'), '新标题');
    expect(doc.fm.title).toBe('新标题');
    expect(doc.hadFrontmatter).toBe(true);
  });

  it('drops a body H1 whose text duplicates the new title', () => {
    const doc = setDocTitle(parseDoc('# 新标题\n\n正文\n'), '新标题');
    expect(doc.fm.title).toBe('新标题');
    expect(doc.body).toBe('正文\n');
  });

  it('leaves a body H1 whose text differs from the new title', () => {
    const doc = setDocTitle(parseDoc('# 旧标题\n\n正文\n'), '新标题');
    expect(doc.fm.title).toBe('新标题');
    expect(doc.body).toBe('# 旧标题\n\n正文\n');
  });

  it('only ever considers the first H1: a later H1 matching the title is left for a human, not auto-dropped', () => {
    // The corresponding guard (scripts/check-post-front.ts) does scan every
    // H1 and would flag this exact shape — this test documents that
    // setDocTitle deliberately does not try to fix it itself.
    const doc = setDocTitle(parseDoc('# 引言\n\n段落。\n\n# 正文标题\n\n更多内容\n'), '正文标题');
    expect(doc.fm.title).toBe('正文标题');
    expect(doc.body).toBe('# 引言\n\n段落。\n\n# 正文标题\n\n更多内容\n');
  });

  it('writes fm.title when the doc already has frontmatter', () => {
    const doc = setDocTitle(parseDoc('---\ntitle: 旧\n---\n\n正文\n'), '新');
    expect(doc.fm.title).toBe('新');
    expect(doc.body).toBe('正文\n');
  });

  it('writes fm.title for a doc with neither frontmatter nor H1', () => {
    const doc = setDocTitle(parseDoc('正文\n'), '新');
    expect(doc.fm.title).toBe('新');
    expect(doc.hadFrontmatter).toBe(true);
  });
});

describe('patchMeta', () => {
  it('sets only the keys given', () => {
    const doc = patchMeta(parseDoc('---\ntitle: Foo\nsource: cnblogs\n---\n\n正文\n'), {
      tags: ['写作'],
      draft: false,
      updated: '2026-08-19T12:00:00+0200',
    });
    expect(doc.fm).toEqual({
      title: 'Foo',
      source: 'cnblogs',
      tags: ['写作'],
      draft: false,
      updated: '2026-08-19T12:00:00+0200',
    });
  });

  it('turns a frontmatter-less legacy post into one without stealing the H1 title', () => {
    const doc = patchMeta(parseDoc('# 老文章\n\n正文\n'), { tags: ['归档'] });
    expect(doc.hadFrontmatter).toBe(true);
    expect(doc.fm).toEqual({ tags: ['归档'] });
    expect(doc.fm.title).toBeUndefined();
    expect(doc.body).toBe('# 老文章\n\n正文\n');
    expect(serializeDoc(doc)).toBe('---\ntags:\n  - 归档\n---\n\n# 老文章\n\n正文\n');
  });
});
