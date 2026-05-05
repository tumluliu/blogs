import { describe, it, expect } from 'vitest';
import { slugify } from './slugify.js';

describe('slugify', () => {
  it('passes through ASCII unchanged (lowercased, hyphenated)', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('A solution to large docker images')).toBe('a-solution-to-large-docker-images');
  });

  it('transliterates Chinese to pinyin without tones', () => {
    expect(slugify('大数据的陷阱')).toBe('da-shu-ju-de-xian-jing');
  });

  it('strips non-alphanumeric punctuation', () => {
    expect(slugify('2023，但愿平凡')).toBe('2023-dan-yuan-ping-fan');
    expect(slugify("don't config DYLD_LIBRARY_PATH")).toBe('dont-config-dyld-library-path');
  });

  it('mixes Chinese and English correctly', () => {
    expect(slugify('迁移至neovim，重启代码工作')).toBe('qian-yi-zhi-neovim-zhong-qi-dai-ma-gong-zuo');
  });

  it('caps length at 60 chars at word boundary', () => {
    const long = 'a'.repeat(80) + '-' + 'b'.repeat(10);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
    expect(slugify(long).endsWith('-')).toBe(false);
  });

  it('returns empty-string-safe sentinel for empty input', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('   ')).toBe('untitled');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo - - bar')).toBe('foo-bar');
  });

  it('is idempotent on already-ASCII slugs', () => {
    const first = slugify('hello-world');
    const second = slugify(first);
    expect(second).toBe(first);
  });
});
