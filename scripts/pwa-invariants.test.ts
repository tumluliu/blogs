// Locks in the pre-flight ruling from 2026-08-19-q-write task 12: Cache
// Storage is origin-wide, so q-write's and q-sort's service workers must
// each scope their `activate` cache-deletion filter to their own cache
// family, or installing one app evicts the other's offline shell. There is
// no importable module here to unit-test against — these are static
// worker/manifest/page files with no runtime seam — so this test reads the
// files directly and asserts the string-level invariants a future refactor
// (e.g. reunifying the two workers) could silently break.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(path), 'utf-8');

describe('PWA cross-app cache isolation (q-sort / q-write)', () => {
  it("q-sort's sw.js scopes its activate deletion filter to qsort- caches", () => {
    const sw = read('public/sw.js');
    expect(sw).toMatch(/keys\.filter\(\(k\)\s*=>\s*k\.startsWith\('qsort-'\)\s*&&\s*k\s*!==\s*CACHE\)/);
  });

  it("q-write's sw-q-write.js scopes its activate deletion filter to qwrite- caches", () => {
    const sw = read('public/sw-q-write.js');
    expect(sw).toMatch(/keys\.filter\(\(k\)\s*=>\s*k\.startsWith\('qwrite-'\)\s*&&\s*k\s*!==\s*CACHE\)/);
  });

  it('neither worker deletes every cache indiscriminately', () => {
    for (const path of ['public/sw.js', 'public/sw-q-write.js']) {
      const sw = read(path);
      // The unscoped predicate this ruling replaced — must not reappear.
      expect(sw).not.toMatch(/keys\.filter\(\(k\)\s*=>\s*k\s*!==\s*CACHE\)/);
    }
  });
});

describe('q-write PWA wiring', () => {
  const manifest = JSON.parse(read('public/q-write.webmanifest')) as {
    scope?: string;
    start_url?: string;
  };
  const page = read('src/pages/q-write/index.astro');

  it("manifest scope and start_url are both '/q-write/'", () => {
    expect(manifest.scope).toBe('/q-write/');
    expect(manifest.start_url).toBe('/q-write/');
  });

  it('the page registers sw-q-write.js at scope /q-write/, matching the manifest', () => {
    expect(page).toMatch(
      /navigator\.serviceWorker\.register\(\s*['"]\/sw-q-write\.js['"]\s*,\s*\{\s*scope:\s*['"]\/q-write\/['"]\s*\}\s*\)/,
    );
  });

  it('robots.txt disallows /q-write/', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^Disallow:\s*\/q-write\/\s*$/m);
  });
});
