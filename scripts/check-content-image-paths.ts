// Reject markdown image refs that use `../` to escape the post's own
// directory. Such paths resolve at the URL layer (`/posts/<slug>/`) rather
// than the filesystem, and silently 404 once the post is served.
//
// Allow:
//   - absolute URLs (http/https)
//   - site-absolute paths (`/diagrams/...`) — served from public/
//   - co-located relative paths (no leading `../`)
//
// Reject:
//   - any `](../...)` in src/content/**/*.md

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOTS = ['src/content/posts', 'src/content/thoughts'];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let ents;
  try {
    ents = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of ents) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full)));
    else if (ent.isFile() && ent.name.endsWith('.md')) out.push(full);
  }
  return out;
}

async function main() {
  const violations: { file: string; line: number; match: string }[] = [];
  for (const root of ROOTS) {
    for (const file of await walk(root)) {
      const body = await readFile(file, 'utf-8');
      const lines = body.split('\n');
      lines.forEach((line, i) => {
        // ![alt](../foo) or [text](../foo)
        const m = line.match(/!\[[^\]]*\]\(\.\.\/[^)]+\)|\[[^\]]+\]\(\.\.\/[^)]+\)/);
        if (m) violations.push({ file, line: i + 1, match: m[0] });
      });
    }
  }

  if (violations.length === 0) {
    console.log('check-content-image-paths: ok');
    return;
  }

  console.error(`check-content-image-paths: ${violations.length} relative-escape ref(s):`);
  for (const v of violations) {
    console.error(`  ${relative(process.cwd(), v.file)}:${v.line}  ${v.match}`);
  }
  console.error('');
  console.error('Fix: move the asset under public/ and use a site-absolute path like /diagrams/foo.png.');
  process.exit(1);
}

void main();
