import { describe, it, expect } from 'vitest';
import { buildFilename, buildFrontmatter, buildMarkdown } from './builders.js';

describe('buildFilename', () => {
  it('formats a date as YYYY-MM-DD-HHmm.md in local time', () => {
    // 2026-05-07 09:07 local
    const d = new Date(2026, 4, 7, 9, 7, 33);
    expect(buildFilename(d)).toBe('2026-05-07-0907.md');
  });

  it('zero-pads single-digit month, day, hour, minute', () => {
    const d = new Date(2026, 0, 1, 0, 0, 0);
    expect(buildFilename(d)).toBe('2026-01-01-0000.md');
  });
});

describe('buildFrontmatter', () => {
  it('emits ISO 8601 with timezone offset and an empty tags array', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const fm = buildFrontmatter(d);
    expect(fm).toContain('date: 2026-05-07T09:07:33+0200');
    expect(fm).toContain('tags: []');
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('---\n')).toBe(true);
  });
});

describe('buildMarkdown', () => {
  it('joins frontmatter and body with a single blank line', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const md = buildMarkdown(d, 'hello, world');
    expect(md).toMatch(/^---\ndate: 2026-05-07T09:07:33\+0200\ntags: \[\]\n---\n\nhello, world\n$/);
  });

  it('preserves trailing newline and trims trailing whitespace from body', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const md = buildMarkdown(d, '  some thought   \n  \n');
    expect(md.endsWith('  some thought\n')).toBe(true);
  });
});
