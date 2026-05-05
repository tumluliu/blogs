// Find all https://*.cnblogs.com/* image refs inside cnblogs-imported posts.
// Download each to src/content/posts/<slug>/img-N.<ext>.
// Rewrite the markdown to point at the local path.
//
// Throttle: 1 request/second.
// Failures are logged to scripts/cnblogs-cache/image-failures.log; original URL stays.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const POSTS_DIR = join('src', 'content', 'posts');
const FAILURES_LOG = join('scripts', 'cnblogs-cache', 'image-failures.log');

// cnblogs hosts images on multiple paths:
//   - https://www.cnblogs.com/images/cnblogs_com/rib06/... (most common, Live Writer uploads)
//   - https://i.cnblogs.com/...
//   - https://images.cnblogs.com/...
//   - https://pic.cnblogs.com/, https://files.cnblogs.com/, etc.
//   - relative /images/cnblogs_com/rib06/... (treat as cnblogs.com)
// The HTML may also use http:// (downgrade) — accept both.
// Require the `!` prefix so we don't pick up regular links (e.g. cross-references to other cnblogs posts).
const MD_IMG_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]*cnblogs\.com\/[^)\s]+)\)/g;
const HTML_IMG_RE = /<img[^>]+src=["'](https?:\/\/[^"']*cnblogs\.com\/[^"']+|\/images\/cnblogs_com\/[^"']+)["'][^>]*>/g;

function extOf(url: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
    return m ? m[1].toLowerCase() : 'png';
  } catch {
    return 'png';
  }
}

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (cnblogs-import-bot)' },
    });
    if (!res.ok) {
      appendFileSync(FAILURES_LOG, `${new Date().toISOString()} HTTP ${res.status} ${url}\n`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buf);
    return true;
  } catch (err) {
    appendFileSync(FAILURES_LOG, `${new Date().toISOString()} ERROR ${(err as Error).message} ${url}\n`);
    return false;
  }
}

interface Result { post: string; downloaded: number; failed: number }

async function processPost(filename: string): Promise<Result> {
  const filePath = join(POSTS_DIR, filename);
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes('source: cnblogs')) {
    return { post: filename, downloaded: 0, failed: 0 };
  }

  const slug = basename(filename, '.md');
  const imgDir = join(POSTS_DIR, slug);

  // Preserve the URL exactly as it appears in the markdown, so replacement
  // matches. We may need a different URL for the actual HTTP fetch (e.g.
  // upgrade http→https, promote relative /images/cnblogs_com/... → absolute);
  // store both as { original, fetch } per entry.
  const refs = new Map<string, string>(); // original → fetch
  let m: RegExpExecArray | null;
  MD_IMG_RE.lastIndex = 0;
  while ((m = MD_IMG_RE.exec(content))) {
    const original = m[2];
    refs.set(original, original.replace(/^http:\/\//, 'https://'));
  }
  HTML_IMG_RE.lastIndex = 0;
  while ((m = HTML_IMG_RE.exec(content))) {
    const original = m[1];
    let fetch = original;
    if (fetch.startsWith('/images/')) fetch = `https://www.cnblogs.com${fetch}`;
    if (fetch.startsWith('http://')) fetch = 'https://' + fetch.slice(7);
    refs.set(original, fetch);
  }

  if (refs.size === 0) return { post: filename, downloaded: 0, failed: 0 };

  if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true });

  const seen = new Map<string, string>(); // original → relPath
  let downloaded = 0;
  let failed = 0;
  let n = 1;

  for (const [original, fetchUrl] of refs) {
    const localName = `img-${n}.${extOf(fetchUrl)}`;
    const localPath = join(imgDir, localName);
    const relPath = `./${slug}/${localName}`;
    n++;
    process.stdout.write(`  ${fetchUrl} → ${relPath} ... `);
    const ok = await downloadImage(fetchUrl, localPath);
    if (ok) {
      seen.set(original, relPath);
      downloaded++;
      process.stdout.write('OK\n');
    } else {
      failed++;
      process.stdout.write('FAIL\n');
    }
    await sleep(1000);
  }

  let next = content;
  for (const [remote, local] of seen) {
    next = next.split(remote).join(local);
  }
  writeFileSync(filePath, next);

  return { post: filename, downloaded, failed };
}

async function main() {
  const cnblogsPosts = readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => readFileSync(join(POSTS_DIR, f), 'utf8').includes('source: cnblogs'));

  console.log(`Scanning ${cnblogsPosts.length} cnblogs posts for images...`);
  let totalDownloaded = 0;
  let totalFailed = 0;
  let postsWithImages = 0;

  for (const post of cnblogsPosts) {
    const result = await processPost(post);
    if (result.downloaded > 0 || result.failed > 0) {
      postsWithImages++;
      console.log(`${post}: ${result.downloaded} downloaded, ${result.failed} failed`);
    }
    totalDownloaded += result.downloaded;
    totalFailed += result.failed;
  }

  console.log('');
  console.log(`Posts with images: ${postsWithImages}`);
  console.log(`Total images downloaded: ${totalDownloaded}`);
  console.log(`Total failures: ${totalFailed}`);
  if (totalFailed > 0) console.log(`Failures logged to: ${FAILURES_LOG}`);
}

main().catch((err) => {
  console.error('Image localization failed:', err);
  process.exit(1);
});
