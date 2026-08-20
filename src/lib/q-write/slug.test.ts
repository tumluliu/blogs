import { describe, it, expect } from 'vitest';
import { slugify } from './slug.js';
import { slugify as nodeSlugify } from '../../../scripts/lib/slugify.js';

// Titles whose slug both implementations agree on. `pinyin-pro` (browser)
// and `pinyin` (node scripts) genuinely disagree on 28 of the 229 real post
// titles, all of them heteronyms where pinyin-pro is the more correct of the
// two (还是 hai-shi vs huan-shi, 什么 shen-me vs shi-mo, 调查 diao-cha vs
// tiao-cha). Reconciling the dictionaries is out of scope and would rename
// live URLs, so the fixture is drawn from the 201 titles that do agree —
// plus the ü cases and the ASCII/punctuation/truncation edges the spec calls
// out, which is where the two are required to stay in lockstep.
const PARITY_FIXTURES = [
  // real post titles
  '空间记忆',
  '2009年的SCI期刊JCR出来了',
  'ArcUser 2006第2期拾零',
  '[备忘]Visio中连接线交叉时跨线小弯的去掉方法',
  '倒退的历史？——某MIS项目手记（1）：“切五花肉”式的分工',
  '从shapefile向postgis导入数据时的字符集编码问题',
  'A solution to "connection reset by peer" when pulling large docker images',
  '“5.8.”，因为忘却，所以记念',
  '2025，技术狂飙，文明堕落',
  // ü finals — the pinyin-pro default drops them entirely
  '女性主义',
  '绿色能源',
  '略微',
  '女娲补天',
  // ASCII, apostrophes, symbol-only, empty
  "don't stop",
  'Hello, World!',
  '！？——',
  '',
  '   ',
];

describe('slugify', () => {
  it('transliterates Chinese to toneless pinyin', () => {
    expect(slugify('空间记忆')).toBe('kong-jian-ji-yi');
  });

  it('handles mixed CJK and ASCII', () => {
    expect(slugify('从 Obsidian 到 q-write')).toBe('cong-obsidian-dao-q-write');
  });

  it('strips apostrophes rather than splitting on them', () => {
    expect(slugify("don't stop")).toBe('dont-stop');
  });

  it('collapses punctuation and trims hyphens', () => {
    expect(slugify('Hello, World! —— 你好')).toBe('hello-world-ni-hao');
  });

  it('truncates at a word boundary past 60 chars', () => {
    const slug = slugify('a'.repeat(30) + ' ' + 'b'.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back to untitled for empty or symbol-only input', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('   ')).toBe('untitled');
    expect(slugify('！？——')).toBe('untitled');
  });

  it('spells ü finals as v instead of deleting them', () => {
    // The [^a-z0-9] strip eats a literal `ü`, so 女性主义 used to slug to
    // `n-xing-zhu-yi`. Slugs are permanent URLs; this must not regress.
    expect(slugify('女性主义')).toBe('nv-xing-zhu-yi');
    expect(slugify('绿色能源')).toBe('lv-se-neng-yuan');
    expect(slugify('略微')).toBe('lve-wei');
  });
});

describe('parity with scripts/lib/slugify.ts', () => {
  it.each(PARITY_FIXTURES)('agrees on %j', (title) => {
    expect(slugify(title)).toBe(nodeSlugify(title));
  });
});
