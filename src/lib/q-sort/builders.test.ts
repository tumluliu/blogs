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

// The stamp is deliberately LOCAL time with a numeric offset, so asserting a
// literal offset would only pass in the author's timezone — it did, and CI
// (UTC) caught it the first time the suite ran there. Assert the contract
// instead: the shape, and that it round-trips to the same instant.
const STAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([+-]\d{4})$/;

function expectedOffset(d: Date): string {
  const mins = -d.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
}

describe('buildFrontmatter', () => {
  it('emits ISO 8601 with timezone offset and an empty tags array', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const fm = buildFrontmatter(d);

    const stamp = fm.match(/^---\ndate: (.+)\n/)?.[1];
    expect(stamp).toBeDefined();
    const parts = stamp!.match(STAMP_RE);
    expect(parts, `stamp not ISO 8601 with numeric offset: ${stamp}`).not.toBeNull();

    // Offset is the runtime's own, and the whole stamp names the same instant.
    expect(parts![2]).toBe(expectedOffset(d));
    expect(new Date(`${parts![1]}${parts![2]}`).getTime()).toBe(d.getTime());

    expect(fm).toContain('tags: []');
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('---\n')).toBe(true);
  });
});

describe('buildMarkdown', () => {
  it('joins frontmatter and body with a single blank line', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const md = buildMarkdown(d, 'hello, world');
    expect(md).toMatch(
      /^---\ndate: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}\ntags: \[\]\n---\n\nhello, world\n$/,
    );
    expect(md).toContain(`date: ${buildFrontmatter(d).match(/date: (.+)/)![1]}`);
  });

  it('preserves trailing newline and trims trailing whitespace from body', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const md = buildMarkdown(d, '  some thought   \n  \n');
    expect(md.endsWith('  some thought\n')).toBe(true);
  });
});
