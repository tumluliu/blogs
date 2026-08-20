// Unit-tests the pure logic behind scripts/check-post-front.ts: the
// per-file rule (findViolations) and the missing/empty-input guard
// (runCheck). Both were added after a review found two real gaps —
// the duplicate-title check only ever looked at a body's first H1, and
// the CLI had no guard for a missing or empty src/content/posts/, so it
// would crash on the former and silently report "ok" on the latter.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findViolations, runCheck } from './check-post-front.js';

describe('findViolations', () => {
  it('passes a post with date and no duplicate title', () => {
    const raw = '---\ntitle: Foo\ndate: "2020-01-01T00:00:00.000Z"\n---\n\n正文\n';
    expect(findViolations('foo.md', raw)).toEqual([]);
  });

  it('flags a post with no date: and no dated filename', () => {
    const raw = '---\ntitle: Foo\n---\n\n正文\n';
    const violations = findViolations('foo.md', raw);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/no resolvable date/);
  });

  it('accepts a YYYY-MM-DD filename prefix in place of frontmatter date', () => {
    const raw = '---\ntitle: Foo\n---\n\n正文\n';
    expect(findViolations('2020-01-02-foo.md', raw)).toEqual([]);
  });

  it('flags a duplicate title on the first H1', () => {
    const raw = '---\ntitle: Foo\ndate: "2020-01-01T00:00:00.000Z"\n---\n\n# Foo\n\n正文\n';
    const violations = findViolations('foo.md', raw);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/duplicate title/);
  });

  it('does not flag a differing first H1', () => {
    const raw = '---\ntitle: Foo\ndate: "2020-01-01T00:00:00.000Z"\n---\n\n# Intro Heading\n\n正文\n';
    expect(findViolations('foo.md', raw)).toEqual([]);
  });

  // The regression the review caught: a body whose *first* H1 differs from
  // the title but whose *second* H1 duplicates it exactly. The old
  // implementation used body.match(H1_RE) — a non-global match, which only
  // ever inspects the first H1 — so this slipped through as clean while the
  // page would still render the title twice (once from frontmatter, once
  // from the second H1).
  it('flags a duplicate title on a later H1 even when the first H1 differs', () => {
    const raw =
      '---\ntitle: Foo\ndate: "2020-01-01T00:00:00.000Z"\n---\n\n# Intro Heading\n\n段落。\n\n# Foo\n\n更多内容\n';
    const violations = findViolations('foo.md', raw);
    expect(violations).toHaveLength(1);
    expect(violations[0].reason).toMatch(/duplicate title/);
  });
});

describe('runCheck', () => {
  it('exits 2 with a clear message when the posts directory does not exist', async () => {
    const missing = join(tmpdir(), 'check-post-front-does-not-exist-' + Date.now());
    const out = await runCheck(missing);
    expect(out.exitCode).toBe(2);
    expect(out.message).toContain(missing);
  });

  it('exits 1 rather than reporting ok when the posts directory is empty', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-post-front-empty-'));
    try {
      const out = await runCheck(dir);
      expect(out.exitCode).toBe(1);
      expect(out.message).not.toMatch(/^check-post-front: ok/);
      expect(out.message).toMatch(/0 posts found/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 0 for a directory of clean posts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-post-front-clean-'));
    try {
      writeFileSync(join(dir, 'foo.md'), '---\ntitle: Foo\ndate: "2020-01-01T00:00:00.000Z"\n---\n\n正文\n');
      const out = await runCheck(dir);
      expect(out.exitCode).toBe(0);
      expect(out.message).toMatch(/^check-post-front: ok \(1 posts scanned\)/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
