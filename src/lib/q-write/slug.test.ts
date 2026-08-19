import { describe, it, expect } from 'vitest';
import { slugify } from './slug.js';

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
});
