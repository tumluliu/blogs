// Walks src/content/posts/*.md, applies pandoc-paragraph-fix to files
// whose frontmatter has `source: cnblogs`. Dry-run by default.
//
// Usage:
//   pnpm tsx scripts/cnblogs/fix-pandoc-paragraphs.ts                # dry-run, all posts
//   pnpm tsx scripts/cnblogs/fix-pandoc-paragraphs.ts --apply        # write changes
//   pnpm tsx scripts/cnblogs/fix-pandoc-paragraphs.ts --slug=foo     # one post (with or without --apply)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fixContent } from '../lib/pandoc-paragraph-fix.js';

const POSTS_DIR = join('src', 'content', 'posts');
const APPLY = process.argv.includes('--apply');
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const ONLY_SLUG = slugArg ? slugArg.slice('--slug='.length) : null;

function isCnblogs(content: string): boolean {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return false;
  return /^source:\s*cnblogs\s*$/m.test(fm[1]);
}

interface Stat { slug: string; changed: boolean; bytesBefore: number; bytesAfter: number }

function processFile(path: string): Stat {
  const slug = basename(path, '.md');
  const before = readFileSync(path, 'utf8');
  if (!isCnblogs(before)) return { slug, changed: false, bytesBefore: before.length, bytesAfter: before.length };
  const after = fixContent(before);
  const changed = after !== before;
  if (changed && APPLY) writeFileSync(path, after);
  return { slug, changed, bytesBefore: before.length, bytesAfter: after.length };
}

function main(): void {
  const all = readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const targets = ONLY_SLUG ? all.filter((f) => f === `${ONLY_SLUG}.md`) : all;
  if (targets.length === 0) {
    console.error(`No matching posts in ${POSTS_DIR}` + (ONLY_SLUG ? ` for slug ${ONLY_SLUG}` : ''));
    process.exit(1);
  }

  let scanned = 0;
  let changed = 0;
  let totalBeforeBytes = 0;
  let totalAfterBytes = 0;

  for (const f of targets) {
    const path = join(POSTS_DIR, f);
    const s = processFile(path);
    scanned++;
    totalBeforeBytes += s.bytesBefore;
    totalAfterBytes += s.bytesAfter;
    if (s.changed) {
      changed++;
      const delta = s.bytesAfter - s.bytesBefore;
      console.log(`${APPLY ? 'WROTE' : 'WOULD '}  ${s.slug.padEnd(60)} bytes ${s.bytesBefore} → ${s.bytesAfter} (${delta >= 0 ? '+' : ''}${delta})`);
    }
  }

  console.log('');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Scanned: ${scanned}`);
  console.log(`Changed: ${changed}`);
  console.log(`Bytes:   ${totalBeforeBytes} → ${totalAfterBytes} (${totalAfterBytes - totalBeforeBytes >= 0 ? '+' : ''}${totalAfterBytes - totalBeforeBytes})`);
  if (!APPLY && changed > 0) console.log(`Re-run with --apply to write changes.`);
}

main();
