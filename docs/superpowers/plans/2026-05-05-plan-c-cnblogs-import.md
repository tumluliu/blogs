# Plan C — cnblogs Aggregation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull the 164 posts (159 blogs + 5 articles) from https://www.cnblogs.com/rib06 into `src/content/posts/`, mixed chronologically with the existing 58 originals. Convert HTML to Markdown, localize images, validate against schema, build green.

**Architecture:** Three phases on a feature branch `import/cnblogs`: (1) fetch via MetaWeblog XML-RPC and cache raw XML, (2) convert each cached post HTML→MD via pandoc and write to `src/content/posts/`, (3) download remote images and rewrite refs. Each phase idempotent and re-runnable.

**Tech Stack:** TypeScript, `xmlrpc` (npm), `cheerio` (HTML scraping), `pandoc` (HTML→MD subprocess), reusing `slugify` and `dedupeSlug` from Plan B.

---

## Prerequisites

- Plan B complete; on branch `astro-migration`.
- Local `pandoc` installed (verify: `pandoc --version`). If missing on macOS: `brew install pandoc`.
- cnblogs **MetaWeblog access password** (different from login password). Get it from https://i.cnblogs.com/settings → "MetaBlog" section → "MetaBlog 访问密码".

---

## Phase 1 — Setup

### Task 1: Branch off and install deps

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/luliu/projects/blogs
git checkout -b import/cnblogs
```

- [ ] **Step 2: Install runtime deps**

```bash
pnpm add xmlrpc cheerio
pnpm add -D @types/xmlrpc
```

- [ ] **Step 3: Verify pandoc**

```bash
which pandoc && pandoc --version | head -1
```

Expected: prints path and version. If missing, install via Homebrew first.

- [ ] **Step 4: Commit deps**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add xmlrpc + cheerio for cnblogs import"
```

### Task 2: Set up secrets handling

**Files:**
- Create: `.env.local` (gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: Add `.env*` to .gitignore (already there from Astro defaults — verify)**

```bash
grep -E '^\.env' .gitignore
```

Expected: matches `.env`, `.env.production`. (Astro added these.) Add `.env.local` if not covered:

```bash
grep -q '^.env.local' .gitignore || echo '.env.local' >> .gitignore
```

- [ ] **Step 2: Create `.env.local`**

Replace `<USERNAME>` and `<PASSWORD>` with your actual cnblogs credentials:

```bash
cat > .env.local <<'EOF'
CNBLOGS_USERNAME=<USERNAME>
CNBLOGS_PASSWORD=<METABLOG_ACCESS_PASSWORD>
CNBLOGS_BLOGID=rib06
EOF
chmod 600 .env.local
```

- [ ] **Step 3: Verify**

```bash
test -f .env.local && echo "OK"
git status .env.local 2>&1
```

Expected: file exists, git status reports it as ignored (no `??` line).

### Task 3: Create cache directory

**Files:**
- Create: `scripts/cnblogs-cache/.gitkeep`

- [ ] **Step 1: Create dir, gitignore the rest**

```bash
mkdir -p scripts/cnblogs-cache
touch scripts/cnblogs-cache/.gitkeep
cat >> .gitignore <<'EOF'

# Local cache for cnblogs import (raw XML responses, may contain credentials in stack traces)
scripts/cnblogs-cache/*.xml
scripts/cnblogs-cache/*.log
EOF
```

- [ ] **Step 2: Commit**

```bash
git add scripts/cnblogs-cache/.gitkeep .gitignore
git commit -m "chore: add cnblogs-cache dir + gitignore raw responses"
```

---

## Phase 2 — Fetch

### Task 4: Write fetch script

**Files:**
- Create: `scripts/cnblogs/fetch.ts`

- [ ] **Step 1: Implement fetcher**

```typescript
// scripts/cnblogs/fetch.ts
//
// Fetch posts from cnblogs MetaWeblog API and cache to disk.
// Idempotent: skips already-cached IDs unless --force is passed.
//
// Usage:
//   pnpm cnblogs:fetch         # fetch and cache new posts
//   pnpm cnblogs:fetch --force # re-fetch even if cached

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import xmlrpc from 'xmlrpc';
import { config as loadEnv } from 'node:process';

// Manual .env.local loader (no dotenv dependency)
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFile('.env.local');

const USERNAME = process.env.CNBLOGS_USERNAME;
const PASSWORD = process.env.CNBLOGS_PASSWORD;
const BLOGID = process.env.CNBLOGS_BLOGID;

if (!USERNAME || !PASSWORD || !BLOGID) {
  console.error('Missing CNBLOGS_USERNAME, CNBLOGS_PASSWORD, or CNBLOGS_BLOGID in .env.local');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
const CACHE_DIR = join('scripts', 'cnblogs-cache');

const client = xmlrpc.createSecureClient({
  url: `https://rpc.cnblogs.com/metaweblog/${USERNAME}`,
});

interface CnblogsPost {
  postid: string;
  title: string;
  description: string;
  dateCreated: Date;
  categories: string[];
  mt_keywords?: string;
  permalink?: string;
  link?: string;
}

function callRpc<T>(method: string, params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) reject(err);
      else resolve(value as T);
    });
  });
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log(`Fetching post list from cnblogs (user: ${USERNAME})...`);

  // getRecentPosts with high limit returns all posts
  const posts = await callRpc<CnblogsPost[]>('metaWeblog.getRecentPosts', [
    BLOGID,
    USERNAME,
    PASSWORD,
    9999,
  ]);

  console.log(`Got ${posts.length} posts.`);

  let cached = 0;
  let skipped = 0;
  for (const post of posts) {
    const id = post.postid;
    const path = join(CACHE_DIR, `${id}.json`);
    if (!FORCE && existsSync(path)) {
      skipped++;
      continue;
    }
    writeFileSync(path, JSON.stringify(post, null, 2));
    cached++;
  }

  console.log(`Cached: ${cached}, skipped: ${skipped}, total: ${posts.length}`);
  console.log(`Cache dir: ${CACHE_DIR}/`);
}

main().catch((err) => {
  console.error('Fetch failed:', err.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Wire up package.json script**

Add to `"scripts"`:

```json
{
  "scripts": {
    "cnblogs:fetch": "tsx scripts/cnblogs/fetch.ts",
    "cnblogs:fetch:force": "tsx scripts/cnblogs/fetch.ts --force"
  }
}
```

- [ ] **Step 3: Commit (no fetch yet)**

```bash
git add scripts/cnblogs/fetch.ts package.json
git commit -m "feat(scripts): add cnblogs MetaWeblog fetch script"
```

### Task 5: Test-fetch with low limit

- [ ] **Step 1: Patch fetch.ts temporarily to fetch only 5 posts**

Edit `scripts/cnblogs/fetch.ts`: change `9999` to `5` for this test.

- [ ] **Step 2: Run**

```bash
pnpm cnblogs:fetch 2>&1 | tail -10
```

Expected: "Got 5 posts. Cached: 5, skipped: 0, total: 5". Five `<id>.json` files in `scripts/cnblogs-cache/`.

- [ ] **Step 3: Inspect one cached post**

```bash
ls scripts/cnblogs-cache/*.json | head -1 | xargs cat | head -30
```

Expected: JSON with `postid`, `title`, `description` (HTML body), `dateCreated`, `categories`. Body looks like real post content.

- [ ] **Step 4: Revert to fetch all (9999)**

Change back to `9999` in fetch.ts.

- [ ] **Step 5: Don't commit the cache**

```bash
git status scripts/cnblogs-cache/  # should be empty (gitignored)
```

### Task 6: Full fetch all 164 posts

- [ ] **Step 1: Run with --force to refresh everything**

```bash
pnpm cnblogs:fetch:force 2>&1 | tail -10
```

Expected: "Got 164 posts. Cached: 164, skipped: 0, total: 164." (Number may vary by ±5; if drastically off, investigate.)

- [ ] **Step 2: Verify count**

```bash
ls scripts/cnblogs-cache/*.json | wc -l
```

Expected: `164` (or close).

- [ ] **Step 3: Sanity check disk usage**

```bash
du -sh scripts/cnblogs-cache/
```

Expected: a few MB. If > 50 MB, posts are larger than expected — fine, but note.

---

## Phase 3 — Convert HTML to Markdown

### Task 7: Write conversion script

**Files:**
- Create: `scripts/cnblogs/convert.ts`

- [ ] **Step 1: Implement converter**

```typescript
// scripts/cnblogs/convert.ts
//
// Convert cached cnblogs posts (JSON containing HTML in `description`) to
// markdown files in src/content/posts/.
//
// - Slug: pinyin from title, deduped against existing posts in src/content/posts/
// - HTML → MD via pandoc subprocess
// - Frontmatter: title, slug, date, tags, source: cnblogs, sourceUrl
// - Idempotent: skips files that already exist (rerun with --overwrite to replace)

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { slugify } from '../lib/slugify.js';
import { dedupeSlug } from '../lib/dedupe-slug.js';

const CACHE_DIR = join('scripts', 'cnblogs-cache');
const POSTS_DIR = join('src', 'content', 'posts');
const OVERWRITE = process.argv.includes('--overwrite');

interface CachedPost {
  postid: string;
  title: string;
  description: string; // HTML body
  dateCreated: string;
  categories: string[];
  mt_keywords?: string;
  permalink?: string;
  link?: string;
}

function htmlToMarkdown(html: string): string {
  // Write HTML to a temp file, run pandoc, read MD output.
  const inFile = join(tmpdir(), `cnblogs-in-${process.pid}.html`);
  const outFile = join(tmpdir(), `cnblogs-out-${process.pid}.md`);
  writeFileSync(inFile, html);
  execSync(
    `pandoc -f html -t gfm --wrap=none "${inFile}" -o "${outFile}"`,
    { stdio: 'pipe' }
  );
  return readFileSync(outFile, 'utf8');
}

function existingSlugs(): Set<string> {
  if (!existsSync(POSTS_DIR)) return new Set();
  return new Set(
    readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => basename(f, '.md')),
  );
}

function normalizeCategories(cats: string[], keywords?: string): string[] {
  const all = [...cats];
  if (keywords) all.push(...keywords.split(/[,，]/));
  return all
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t, i, a) => a.indexOf(t) === i);
}

function main() {
  if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });

  const used = existingSlugs();
  const cacheFiles = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Converting ${cacheFiles.length} cached posts...`);

  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of cacheFiles) {
    try {
      const post: CachedPost = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8'));
      const baseSlug = slugify(post.title);
      const slug = dedupeSlug(baseSlug, used);
      const targetPath = join(POSTS_DIR, `${slug}.md`);

      if (!OVERWRITE && existsSync(targetPath)) {
        skipped++;
        continue;
      }

      const md = htmlToMarkdown(post.description || '').trim();
      const frontmatter = {
        title: post.title || '(untitled)',
        slug,
        date: post.dateCreated,
        tags: normalizeCategories(post.categories ?? [], post.mt_keywords),
        source: 'cnblogs',
        sourceUrl: post.permalink ?? post.link ?? `https://www.cnblogs.com/rib06/p/${post.postid}.html`,
        draft: md.length === 0,
      };

      const content = `---\n${yaml.dump(frontmatter, { lineWidth: 200, quotingType: '"' })}---\n\n${md}\n`;
      writeFileSync(targetPath, content);
      used.add(slug);
      written++;
    } catch (err) {
      console.error(`Error on ${file}:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`Wrote: ${written}, skipped: ${skipped}, errors: ${errors}`);
}

main();
```

- [ ] **Step 2: Wire script in package.json**

Add to `"scripts"`:

```json
{
  "cnblogs:convert": "tsx scripts/cnblogs/convert.ts",
  "cnblogs:convert:overwrite": "tsx scripts/cnblogs/convert.ts --overwrite"
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/cnblogs/convert.ts package.json
git commit -m "feat(scripts): add cnblogs HTML→MD converter via pandoc"
```

### Task 8: Convert sample (3 posts) and eyeball

- [ ] **Step 1: Run on cache directory contents**

```bash
pnpm cnblogs:convert 2>&1 | tail -5
```

Expected: "Wrote: 164, skipped: 0, errors: 0" (or close to 164 if some posts were already in src/content/posts as collisions).

- [ ] **Step 2: Spot-check 3 random imported posts**

```bash
for f in $(ls src/content/posts/*.md | grep -l 'source: cnblogs' 2>/dev/null | shuf -n 3); do
  echo "=== $f ==="
  head -25 "$f"
  echo ""
done
```

Expected: each has frontmatter with `source: cnblogs`, `sourceUrl` pointing to cnblogs, valid date, body that looks like actual content.

- [ ] **Step 3: Spot-check counts**

```bash
echo "Total posts: $(ls src/content/posts/*.md | wc -l)"
echo "From cnblogs: $(grep -l 'source: cnblogs' src/content/posts/*.md | wc -l)"
echo "Original (Plan B): $(grep -l 'source: original' src/content/posts/*.md | wc -l)"
```

Expected: total ≈ 222 (58 + 164), each source category sums to total.

### Task 9: Schema validation

- [ ] **Step 1: Run astro check**

```bash
pnpm astro check 2>&1 | tail -10
```

Expected: 0 errors. If errors:
- Read each error message — usually says which file and which field.
- Common issues: invalid date string from cnblogs (fix by parsing more leniently), HTML entities in title (unescape).
- Fix the convert.ts logic, re-run with `--overwrite`, re-check.

- [ ] **Step 2: If errors, iterate; once 0 errors, commit imported posts**

```bash
git add src/content/posts/
git commit -m "import: 164 posts from cnblogs (source: cnblogs)"
```

---

## Phase 4 — Image localization

### Task 10: Image scanner + downloader script

**Files:**
- Create: `scripts/cnblogs/localize-images.ts`

- [ ] **Step 1: Implement**

```typescript
// scripts/cnblogs/localize-images.ts
//
// Find all https://i.cnblogs.com/* and https://images.cnblogs.com/* image refs
// inside cnblogs-imported posts. Download each to src/content/posts/<slug>/img-N.<ext>.
// Rewrite the markdown to point at the local path.
//
// Throttle: 1 request/second to avoid rate-limiting.
// Failures are logged to scripts/cnblogs-cache/image-failures.log; original URL stays.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const POSTS_DIR = join('src', 'content', 'posts');
const FAILURES_LOG = join('scripts', 'cnblogs-cache', 'image-failures.log');

const IMG_RE = /!?\[([^\]]*)\]\((https:\/\/(?:i|images?)\.cnblogs\.com\/[^)\s]+)\)/g;
const HTML_IMG_RE = /<img[^>]+src=["'](https:\/\/(?:i|images?)\.cnblogs\.com\/[^"']+)["'][^>]*>/g;

function extOf(url: string): string {
  const u = new URL(url);
  const m = u.pathname.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'png';
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

async function processPost(filename: string): Promise<{ post: string; downloaded: number; failed: number }> {
  const filePath = join(POSTS_DIR, filename);
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes('source: cnblogs')) {
    return { post: filename, downloaded: 0, failed: 0 };
  }

  const slug = basename(filename, '.md');
  const imgDir = join(POSTS_DIR, slug);
  let next = content;
  let downloaded = 0;
  let failed = 0;
  let n = 1;
  const seen = new Map<string, string>(); // remoteUrl -> localPath

  // Collect all unique URLs first
  const urls = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(content))) urls.add(m[2]);
  HTML_IMG_RE.lastIndex = 0;
  while ((m = HTML_IMG_RE.exec(content))) urls.add(m[1]);

  if (urls.size === 0) return { post: filename, downloaded: 0, failed: 0 };

  if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true });

  for (const url of urls) {
    const localName = `img-${n}.${extOf(url)}`;
    const localPath = join(imgDir, localName);
    const relPath = `./${slug}/${localName}`;
    n++;
    process.stdout.write(`  ${url} → ${relPath} ... `);
    const ok = await downloadImage(url, localPath);
    if (ok) {
      seen.set(url, relPath);
      downloaded++;
      process.stdout.write('OK\n');
    } else {
      failed++;
      process.stdout.write('FAIL\n');
    }
    await sleep(1000); // 1 req/sec
  }

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

main();
```

- [ ] **Step 2: Wire in package.json**

```json
{
  "cnblogs:images": "tsx scripts/cnblogs/localize-images.ts"
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/cnblogs/localize-images.ts package.json
git commit -m "feat(scripts): add cnblogs image localizer"
```

### Task 11: Run image localization

- [ ] **Step 1: Run (this can take a while at 1 req/sec)**

```bash
pnpm cnblogs:images 2>&1 | tee /tmp/cnblogs-images.log
```

Expected: each cnblogs post with images: lines like `<url> → ./<slug>/img-N.png ... OK`. End: total counts.

Time estimate: with N images at 1 req/sec, ≈ N seconds. If 200 images, ~3.5 min.

- [ ] **Step 2: Inspect failures**

```bash
test -f scripts/cnblogs-cache/image-failures.log && cat scripts/cnblogs-cache/image-failures.log || echo "no failures"
```

If failures: most are likely 404s from very old posts where images were deleted. The original URL stays in the MD as a fallback. Decide: leave as-is or manually find replacements. For Plan C, leave as-is.

- [ ] **Step 3: Verify a post with images now references local paths**

```bash
grep -l 'source: cnblogs' src/content/posts/*.md | xargs grep -l 'img-1\.' | head -1 | xargs head -50 | tail -30
```

Expected: at least one post shows `![](./<slug>/img-1.png)` or similar local refs.

- [ ] **Step 4: Commit images**

```bash
git add src/content/posts/
git commit -m "import: localize cnblogs images (downloaded N, failed M)"
```

---

## Phase 5 — Validate, build, merge back

### Task 12: Schema check after image localization

- [ ] **Step 1: astro check**

```bash
pnpm astro check 2>&1 | tail -10
```

Expected: 0 errors.

### Task 13: Production build

- [ ] **Step 1: Build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: "Complete!". Page count grew significantly: ~58 → ~220 post pages.

```bash
echo "Post pages: $(find dist/posts -name 'index.html' -mindepth 2 | wc -l)"
echo "Tag pages: $(find dist/tags -name '*.html' 2>/dev/null | wc -l)"
echo "Total HTML: $(find dist -name '*.html' | wc -l)"
```

Expected:
- Post pages: ~220 (58 + 164 minus drafts).
- Tag pages: > 0 (cnblogs imports brought real categories).
- Total HTML: > 250.

### Task 14: Spot-check 5 random imported posts vs cnblogs originals

- [ ] **Step 1: Start preview**

```bash
pnpm preview &
PID=$!
sleep 4
```

- [ ] **Step 2: Pick 5 random cnblogs posts and visit local + remote**

```bash
for f in $(grep -l 'source: cnblogs' src/content/posts/*.md | shuf -n 5); do
  slug=$(basename "$f" .md)
  source_url=$(grep '^sourceUrl:' "$f" | sed 's/sourceUrl: *//' | tr -d '"')
  echo "Local : http://localhost:4321/posts/$slug/"
  echo "Source: $source_url"
  echo ""
done
```

Open each pair in browser tabs and compare:
- Title matches.
- Body content roughly matches (whitespace differences OK).
- Code blocks rendered.
- Images either local or external (with fallback URL still working).

- [ ] **Step 3: Stop preview**

```bash
kill $PID 2>/dev/null
wait 2>/dev/null
```

### Task 15: Final verification gate

- [ ] **Step 1: Confirm clean tree**

```bash
git status -s
```

Expected: empty or only `.obsidian/workspace.json` modifications (workspace state, ignored).

- [ ] **Step 2: Test suite still green**

```bash
pnpm vitest run 2>&1 | tail -5
```

Expected: 12 tests pass (slugify and dedupeSlug are unchanged).

- [ ] **Step 3: Final post count**

```bash
echo "Total: $(ls src/content/posts/*.md | wc -l)"
echo "Original: $(grep -l 'source: original' src/content/posts/*.md | wc -l)"
echo "From cnblogs: $(grep -l 'source: cnblogs' src/content/posts/*.md | wc -l)"
echo "Drafts: $(grep -l 'draft: true' src/content/posts/*.md | wc -l)"
```

Expected: ~222 total, 58 original, 164 cnblogs (or close), N drafts including any empty cnblogs posts.

### Task 16: Merge to astro-migration branch

- [ ] **Step 1: Switch back and merge**

```bash
git checkout astro-migration
git merge --no-ff import/cnblogs -m "Merge import/cnblogs: add 164 archived posts from cnblogs"
git log --oneline -5
```

- [ ] **Step 2: Final sign-off**

Add a line to your scratchpad:

```
Plan C complete: 2026-05-05
222 posts in src/content/posts/. cnblogs archive consolidated. Build green.
Cleared to start Plan D (VM rebuild + cutover).
```

---

## Done

When all tasks above are checked, Plan C is complete:

1. 164 cnblogs posts imported into `src/content/posts/` with `source: cnblogs`.
2. Original Chinese titles preserved; pinyin slugs used; mixed timeline with the 58 originals.
3. Images downloaded locally per post (where reachable); failures logged but build still succeeds.
4. Schema validates all 222 posts. `pnpm build` green.
5. cnblogs-import branch merged back to `astro-migration`.

Live `https://luliu.me` is still on the old Hexo. Cutover is Plan D.

**Next:** request Plan D (VM rebuild + cutover) — final phase.
