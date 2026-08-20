import { describe, expect, it } from 'vitest';
import { stableThoughtGuid } from './thought-guid';

// The exact `date` frontmatter of every thought under src/content/thoughts as
// of this task, transcribed verbatim (including mixed UTC/+0200 offsets) so
// the uniqueness check below runs against the real data, not a synthetic
// stand-in that could hide a collision the real dataset actually has.
const REAL_THOUGHT_DATES = [
  '2026-05-05T19:19:46.705Z',
  '2026-05-06T21:41:54+0200',
  '2026-05-07T09:37:21+0200',
  '2026-05-07T16:37:08+0200',
  '2026-05-07T16:43:18+0200',
  '2026-05-07T20:59:55+0200',
  '2026-05-08T13:47:34+0200',
  '2026-05-15T22:25:57+0200',
  '2026-05-24T13:53:28+0200',
  '2026-05-31T22:08:42+0200',
  '2026-06-11T11:02:33+0200',
  '2026-06-18T13:32:32+0200',
  '2026-06-27T20:32:17+0200',
  '2026-07-22T16:23:28+0200',
  '2026-08-15T10:33:08+0200',
  '2026-08-16T15:23:57+0200',
  '2026-08-16T15:42:13+0200',
  '2026-08-18T09:38:49+0200',
  '2026-08-18T10:55:01+0200',
];

describe('stableThoughtGuid', () => {
  it('is unique across all 19 real thought dates', () => {
    const guids = REAL_THOUGHT_DATES.map((d) => stableThoughtGuid(new Date(d)));
    expect(new Set(guids).size).toBe(REAL_THOUGHT_DATES.length);
  });

  it('is stable: the same instant always yields the same value', () => {
    const a = stableThoughtGuid(new Date('2026-08-18T10:55:01+0200'));
    const b = stableThoughtGuid(new Date('2026-08-18T08:55:01.000Z')); // same instant, different Date object
    expect(a).toBe(b);
  });

  it('distinguishes dates that differ only by seconds or milliseconds', () => {
    // Real data never collides at minute granularity, but the implementation
    // must not silently truncate precision (e.g. to minutes) regardless.
    const a = stableThoughtGuid(new Date('2026-08-18T10:55:01.100+0200'));
    const b = stableThoughtGuid(new Date('2026-08-18T10:55:01.900+0200'));
    const c = stableThoughtGuid(new Date('2026-08-18T10:55:59+0200'));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('produces the exact expected format: a millisecond-precision ISO 8601 instant, prefixed and not a URL', () => {
    const guid = stableThoughtGuid(new Date('2026-08-18T10:55:01+0200'));
    expect(guid).toBe('thought:2026-08-18T08:55:01.000Z');
    expect(guid).not.toMatch(/^https?:\/\//);
  });
});
