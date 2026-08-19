import { describe, it, expect } from 'vitest';
import { postPath, mediaPath, mediaUrl, slugFromEntryName } from './paths.js';

describe('paths', () => {
  it('builds the post path from a slug', () => {
    expect(postPath('kong-jian-ji-yi')).toBe('src/content/posts/kong-jian-ji-yi.md');
  });

  it('builds a zero-padded media path under public/', () => {
    const d = new Date(2026, 7, 19); // August
    expect(mediaPath(d, 'a3f91c02', 'webp')).toBe('public/media/2026/08/a3f91c02.webp');
  });

  it('builds the site-absolute URL for the same asset', () => {
    const d = new Date(2026, 7, 19);
    expect(mediaUrl(d, 'a3f91c02', 'webp')).toBe('/media/2026/08/a3f91c02.webp');
  });

  it('never emits a relative-escape path', () => {
    expect(mediaUrl(new Date(2026, 0, 1), 'ff00ff00', 'jpg').startsWith('/')).toBe(true);
  });

  it('strips the .md extension from a directory entry name', () => {
    expect(slugFromEntryName('kong-jian-ji-yi.md')).toBe('kong-jian-ji-yi');
  });
});
