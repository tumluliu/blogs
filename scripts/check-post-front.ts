// Guard two content invariants the site's rendering and dating rely on but
// nothing else enforces at build time:
//
//   1. Every post must have a resolvable date. The content loader
//      (src/content.config.ts) falls back to `date:` in frontmatter, then a
//      `YYYY-MM-DD` filename prefix, then the file's mtime as a last
//      resort — but mtime is not a stable date: `actions/checkout` in CI
//      rewrites it on every deploy, silently re-dating the post to "today"
//      and resorting it to the top of the home page and the feed. A post
//      with neither `date:` nor a dated filename is a latent bug, not a
//      valid post — see the "关于Meta关闭Metaverse" incident this guard
//      exists to prevent from recurring.
//   2. A post's title must render exactly once. The page template renders
//      `<h1>{post.data.title}</h1>` and then the post body, so a post that
//      carries both `title:` in frontmatter and a body `# H1` with the
//      same text renders that title twice — see ce-shi-q-write.md. Every
//      H1 in the body is checked, not just the first: q-write's own writer
//      (setDocTitle in src/lib/q-write/frontmatter.ts) deliberately only
//      ever cleans up a duplicate sitting in the *first* H1, so a duplicate
//      anywhere else in the body is exactly the shape this guard exists to
//      still catch before it ships.
//
// Fails with a clear per-file message for any post in src/content/posts/
// that violates either invariant. Also fails — loudly, not silently — if
// the posts directory is missing or the scan turns up zero posts: a guard
// that reports "ok" when its own input has vanished isn't a guard.
//
// Exit 0 if clean, 1 if any violation is found (including an empty scan),
// 2 if src/content/posts/ itself doesn't exist.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const POSTS_DIR = 'src/content/posts';

export async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const ents = await readdir(dir, { withFileTypes: true });
  for (const ent of ents) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full)));
    else if (ent.isFile() && ent.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// Mirrors dateFromFilename in src/content.config.ts: a `YYYY-MM-DD` (with
// an optional `-HHmm`) prefix on the filename.
const FILENAME_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?/;

// Every `# ` line in the body, not just the first — unlike q-write's writer
// (see the module comment above), this guard's job is to catch a duplicate
// wherever it is.
const H1_RE = /^#\s+(.+?)\s*$/gm;

export interface Violation {
  file: string;
  reason: string;
}

// Pure per-file check: no filesystem access beyond what the caller already
// read. `relPath` is only used for the message, so callers can pass an
// absolute path, a repo-relative one, or a synthetic name in a test.
export function findViolations(relPath: string, raw: string): Violation[] {
  const { data: fm, content } = matter(raw);
  const violations: Violation[] = [];

  if (fm.date === undefined) {
    const stem = basename(relPath, '.md');
    if (!FILENAME_DATE_RE.test(stem)) {
      violations.push({
        file: relPath,
        reason:
          'no resolvable date — no `date:` in frontmatter and no `YYYY-MM-DD` filename prefix ' +
          "(the file's mtime is not a stable date: CI's checkout rewrites it on every deploy)",
      });
    }
  }

  const title = typeof fm.title === 'string' ? fm.title.trim() : '';
  if (title) {
    for (const m of content.matchAll(H1_RE)) {
      const h1 = m[1].trim();
      if (h1 === title) {
        violations.push({
          file: relPath,
          reason: `duplicate title — frontmatter \`title: ${title}\` matches body \`# ${h1}\`; the page renders both`,
        });
        break; // one report per file is enough to point someone at it
      }
    }
  }

  return violations;
}

export interface CheckOutcome {
  exitCode: 0 | 1 | 2;
  message: string;
}

export async function runCheck(postsDir: string): Promise<CheckOutcome> {
  if (!existsSync(postsDir)) {
    return {
      exitCode: 2,
      message: `check-post-front: ${resolve(postsDir)} not found.`,
    };
  }

  const files = await walk(postsDir);

  if (files.length === 0) {
    return {
      exitCode: 1,
      message:
        `check-post-front: 0 posts found under ${postsDir}.\n` +
        'Refusing to report "ok" on an empty scan — that hides the check having lost its own input ' +
        'rather than finding a clean corpus.',
    };
  }

  const violations: Violation[] = [];
  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    violations.push(...findViolations(relative(process.cwd(), file), raw));
  }

  if (violations.length === 0) {
    return { exitCode: 0, message: `check-post-front: ok (${files.length} posts scanned)` };
  }

  const lines = [`check-post-front: ${violations.length} problem(s):`];
  for (const v of violations) {
    lines.push(`  ${v.file}`);
    lines.push(`    ${v.reason}`);
  }
  lines.push('');
  lines.push(
    'Hint: give the post a `date:` (or a YYYY-MM-DD filename prefix), and drop the body H1 when ' +
      'it only repeats the frontmatter title.',
  );
  return { exitCode: 1, message: lines.join('\n') };
}

async function main() {
  const { exitCode, message } = await runCheck(POSTS_DIR);
  if (exitCode === 0) console.log(message);
  else console.error(message);
  process.exit(exitCode);
}

// Only run as a CLI when executed directly (`tsx scripts/check-post-front.ts`
// / `pnpm check:post-front`) — not when imported by check-post-front.test.ts,
// which would otherwise trigger a real scan (and a real `process.exit`) as a
// side effect of the import.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) void main();
