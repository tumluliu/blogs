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
//      same text renders that title twice — see ce-shi-q-write.md.
//
// Fails with a clear per-file message for any post in src/content/posts/
// that violates either invariant.
//
// Exit 0 if clean, 1 if any violation is found.

import { readFile, readdir } from 'node:fs/promises';
import { join, basename, relative } from 'node:path';
import matter from 'gray-matter';

const POSTS_DIR = 'src/content/posts';

async function walk(dir: string): Promise<string[]> {
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

// Mirrors extractFirstH1 in src/content.config.ts.
const H1_RE = /^#\s+(.+?)\s*$/m;

interface Violation {
  file: string;
  reason: string;
}

async function main() {
  const files = await walk(POSTS_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const raw = await readFile(file, 'utf-8');
    const { data: fm, content } = matter(raw);
    const rel = relative(process.cwd(), file);

    if (fm.date === undefined) {
      const stem = basename(file, '.md');
      if (!FILENAME_DATE_RE.test(stem)) {
        violations.push({
          file: rel,
          reason:
            'no resolvable date — no `date:` in frontmatter and no `YYYY-MM-DD` filename prefix ' +
            "(the file's mtime is not a stable date: CI's checkout rewrites it on every deploy)",
        });
      }
    }

    const title = typeof fm.title === 'string' ? fm.title.trim() : '';
    if (title) {
      const m = content.match(H1_RE);
      const h1 = m ? m[1].trim() : null;
      if (h1 !== null && h1 === title) {
        violations.push({
          file: rel,
          reason: `duplicate title — frontmatter \`title: ${title}\` matches body \`# ${h1}\`; the page renders both`,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`check-post-front: ok (${files.length} posts scanned)`);
    return;
  }

  console.error(`check-post-front: ${violations.length} problem(s):`);
  for (const v of violations) {
    console.error(`  ${v.file}`);
    console.error(`    ${v.reason}`);
  }
  console.error('');
  console.error(
    'Hint: give the post a `date:` (or a YYYY-MM-DD filename prefix), and drop the body H1 when ' +
      'it only repeats the frontmatter title.',
  );
  process.exit(1);
}

void main();
