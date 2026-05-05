# Plan B — Astro Scaffold + 58-Post Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Astro 5 site in this repo, migrate the 58 existing markdown posts (rename to ASCII slugs, normalize tags, move into the `posts` content collection), build a minimal theme, and prove the site builds locally with all 58 posts validated by schema. cnblogs import is Plan C.

**Architecture:** Astro 5 with content collections (`posts`, `thoughts`), Zod schemas for frontmatter validation, file-based routing, system-stack typography theme. Migration scripts live in `scripts/` and are TypeScript run via `tsx`. TDD for the slug renamer.

**Tech Stack:** Astro 5, pnpm, TypeScript, Zod, tsx, vitest, pinyin (npm), js-yaml, @astrojs/rss, @astrojs/sitemap.

---

## Prerequisites

- On branch `astro-migration` (Plan A left us here).
- Node 22+ and pnpm 9+ installed locally.
- Local backup at `~/vm-backup-2026-05-05/` retained as safety net.

```bash
node --version    # v22.x or higher
pnpm --version    # 9.x or higher
```

If pnpm missing: `npm install -g pnpm@9`.

---

## Phase 1 — Scaffold the Astro project

### Task 1: Initialize Astro project in repo root

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `astro.config.mjs`, `tsconfig.json`, `.gitignore` (merge), `src/`, `public/`

- [ ] **Step 1: Run Astro create in non-interactive mode**

```bash
cd /Users/luliu/projects/blogs
pnpm create astro@latest . --template minimal --typescript strict --no-install --no-git --skip-houston --yes
```

Expected: scaffolds `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, `public/favicon.svg`. Will NOT overwrite our existing `.gitignore` content but appends. Will NOT touch existing `*.md` files at repo root (those become migration source in Phase 3).

- [ ] **Step 2: Verify scaffold**

```bash
test -f package.json && test -f astro.config.mjs && test -d src/pages && echo "scaffold OK"
ls src/
```

Expected: `scaffold OK` and `pages/` directory present.

- [ ] **Step 3: Merge .gitignore (Astro added entries)**

Verify `.gitignore` has these lines (append any missing):

```bash
cat >> .gitignore <<'EOF'
# Astro
dist/
.astro/

# Node
node_modules/

# OS
.DS_Store

# editor
.vscode/*
!.vscode/extensions.json
EOF
sort -u .gitignore -o .gitignore
cat .gitignore
```

Expected output includes: `.obsidian/`, `vm-backup-*/`, `dist/`, `.astro/`, `node_modules/`, `.DS_Store`.

- [ ] **Step 4: Install dependencies**

```bash
pnpm install
```

Expected: `node_modules/` populated, `pnpm-lock.yaml` generated. No errors.

- [ ] **Step 5: Add the dependencies we'll need**

```bash
pnpm add -D vitest tsx @types/node @types/js-yaml
pnpm add @astrojs/rss @astrojs/sitemap js-yaml pinyin gray-matter zod
```

Expected: all packages install cleanly. (Astro 5 already brings Zod transitively; explicit dep is fine.)

- [ ] **Step 6: Smoke test — does Astro start?**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -sI http://localhost:4321/ | head -1
kill $DEV_PID 2>/dev/null
wait 2>/dev/null
```

Expected: `HTTP/1.1 200 OK`. Dev server boots even before content is added.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs tsconfig.json .gitignore src/ public/
git commit -m "feat: scaffold Astro 5 project (Plan B step 1)"
```

### Task 2: Configure astro.config.mjs

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Replace contents**

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://luliu.me',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
```

- [ ] **Step 2: Verify config syntax**

```bash
pnpm astro check --noSync 2>&1 | tail -5
```

Expected: no syntax errors. (Type errors about missing collections are expected at this point — fixed in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "feat: configure Astro site URL, sitemap, image pipeline"
```

### Task 3: Define content collections schema

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/posts/.gitkeep`
- Create: `src/content/thoughts/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/content/posts src/content/thoughts
touch src/content/posts/.gitkeep src/content/thoughts/.gitkeep
```

- [ ] **Step 2: Write schema**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase ASCII with hyphens').optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: image().optional(),
    draft: z.boolean().default(false),
    source: z.enum(['original', 'cnblogs']).default('original'),
    sourceUrl: z.string().url().optional(),
  }),
});

const thoughts = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts, thoughts };
```

- [ ] **Step 3: Type-check**

```bash
pnpm astro sync && pnpm astro check 2>&1 | tail -5
```

Expected: 0 errors, 0 warnings (collections empty so far).

- [ ] **Step 4: Commit**

```bash
git add src/content/
git commit -m "feat: define posts + thoughts content collections with Zod schemas"
```

---

## Phase 2 — Slug rename script (TDD)

The script reads each `*.md` at the repo root, generates an ASCII slug from the Chinese title (or filename), and renames the file with `git mv` while preserving the original title in frontmatter.

### Task 4: Write the failing tests for `slugify`

**Files:**
- Create: `scripts/lib/slugify.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write the tests**

```typescript
// scripts/lib/slugify.test.ts
import { describe, it, expect } from 'vitest';
import { slugify } from './slugify.js';

describe('slugify', () => {
  it('passes through ASCII unchanged (lowercased, hyphenated)', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('A solution to large docker images')).toBe('a-solution-to-large-docker-images');
  });

  it('transliterates Chinese to pinyin without tones', () => {
    expect(slugify('大数据的陷阱')).toBe('da-shu-ju-de-xian-jing');
  });

  it('strips non-alphanumeric punctuation', () => {
    expect(slugify('2023，但愿平凡')).toBe('2023-dan-yuan-ping-fan');
    expect(slugify("don't config DYLD_LIBRARY_PATH")).toBe('dont-config-dyld-library-path');
  });

  it('mixes Chinese and English correctly', () => {
    expect(slugify('迁移至neovim，重启代码工作')).toBe('qian-yi-zhi-neovim-zhong-qi-dai-ma-gong-zuo');
  });

  it('caps length at 60 chars at word boundary', () => {
    const long = 'a'.repeat(80) + '-' + 'b'.repeat(10);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
    expect(slugify(long).endsWith('-')).toBe(false);
  });

  it('returns empty-string-safe sentinel for empty input', () => {
    expect(slugify('')).toBe('untitled');
    expect(slugify('   ')).toBe('untitled');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo - - bar')).toBe('foo-bar');
  });

  it('is idempotent on already-ASCII slugs', () => {
    const first = slugify('hello-world');
    const second = slugify(first);
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 3: Run tests, confirm they fail**

```bash
pnpm vitest run scripts/lib/slugify.test.ts 2>&1 | tail -20
```

Expected: tests fail with `Cannot find module './slugify.js'` or similar.

### Task 5: Implement `slugify`

**Files:**
- Create: `scripts/lib/slugify.ts`

- [ ] **Step 1: Implement**

```typescript
// scripts/lib/slugify.ts
import pinyin from 'pinyin';

const MAX_LEN = 60;

export function slugify(input: string): string {
  if (!input || !input.trim()) return 'untitled';

  // Convert any Chinese characters to pinyin (no tones, joined with spaces)
  const transliterated = pinyin(input, {
    style: pinyin.STYLE_NORMAL,
    heteronym: false,
  })
    .map((arr) => arr[0])
    .join(' ');

  // Lowercase, replace non-alphanumerics with hyphen, collapse hyphens, trim
  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!slug) return 'untitled';

  // Truncate at word boundary if too long
  if (slug.length > MAX_LEN) {
    const cut = slug.slice(0, MAX_LEN);
    const lastDash = cut.lastIndexOf('-');
    slug = lastDash > 20 ? cut.slice(0, lastDash) : cut;
  }

  return slug;
}
```

- [ ] **Step 2: Run tests, expect all pass**

```bash
pnpm vitest run scripts/lib/slugify.test.ts 2>&1 | tail -10
```

Expected: `8 passed`.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/slugify.ts scripts/lib/slugify.test.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "feat(scripts): add slugify with pinyin + ASCII normalization, TDD"
```

### Task 6: Write tests for collision-resolution helper

**Files:**
- Create: `scripts/lib/dedupe-slug.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// scripts/lib/dedupe-slug.test.ts
import { describe, it, expect } from 'vitest';
import { dedupeSlug } from './dedupe-slug.js';

describe('dedupeSlug', () => {
  it('returns slug unchanged if not in set', () => {
    expect(dedupeSlug('hello', new Set())).toBe('hello');
  });

  it('appends -2 if slug exists', () => {
    expect(dedupeSlug('hello', new Set(['hello']))).toBe('hello-2');
  });

  it('finds next free suffix', () => {
    expect(dedupeSlug('hello', new Set(['hello', 'hello-2', 'hello-3']))).toBe('hello-4');
  });

  it('does not collide with the slug being inserted', () => {
    const used = new Set(['post', 'post-2']);
    const next = dedupeSlug('post', used);
    expect(next).toBe('post-3');
    used.add(next);
    expect(dedupeSlug('post', used)).toBe('post-4');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm vitest run scripts/lib/dedupe-slug.test.ts 2>&1 | tail -10
```

### Task 7: Implement `dedupeSlug`

**Files:**
- Create: `scripts/lib/dedupe-slug.ts`

- [ ] **Step 1: Implement**

```typescript
// scripts/lib/dedupe-slug.ts
export function dedupeSlug(slug: string, used: Set<string>): string {
  if (!used.has(slug)) return slug;
  let n = 2;
  while (used.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run scripts/lib/dedupe-slug.test.ts 2>&1 | tail -5
```

Expected: `4 passed`.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/dedupe-slug.ts scripts/lib/dedupe-slug.test.ts
git commit -m "feat(scripts): add dedupeSlug for collision suffixing"
```

### Task 8: Write the rename script (no TDD — orchestration script with file I/O; tests would mock too much)

**Files:**
- Create: `scripts/rename-to-slug.ts`

- [ ] **Step 1: Implement**

```typescript
// scripts/rename-to-slug.ts
//
// One-shot migration: rename root-level *.md files to ASCII-slug names,
// move them into src/content/posts/, and normalize frontmatter.
// Idempotent. Default is dry-run; pass --apply to mutate.
//
// Frontmatter rules:
//   - title: preserve original (Chinese OK); default to filename if absent.
//   - slug: set to the new ASCII slug.
//   - date: parse existing if present; require manual fix if missing.
//   - updated: keep if present.
//   - tags: drop "Notebooks/blog" prefix; keep the rest.
//   - draft: set to true if body is empty (whitespace only).
//
// Performs git mv. Run only on a feature branch.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { slugify } from './lib/slugify.js';
import { dedupeSlug } from './lib/dedupe-slug.js';

const REPO_ROOT = process.cwd();
const POSTS_DIR = join(REPO_ROOT, 'src', 'content', 'posts');
const APPLY = process.argv.includes('--apply');

interface RenamePlan {
  oldPath: string;
  newPath: string;
  oldFilename: string;
  newFilename: string;
  title: string;
  isEmpty: boolean;
  tagsBefore: string[];
  tagsAfter: string[];
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t))
    .map((t) => t.replace(/^Notebooks\//i, ''))
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.toLowerCase() !== 'blog')
    // (drop the generic "blog" tag because every post has it)
    .filter((t, i, a) => a.indexOf(t) === i); // dedupe
}

function listRootMarkdown(): string[] {
  return readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => statSync(join(REPO_ROOT, f)).isFile());
}

function buildPlan(): RenamePlan[] {
  const used = new Set<string>();
  const plan: RenamePlan[] = [];

  for (const file of listRootMarkdown().sort()) {
    const oldPath = join(REPO_ROOT, file);
    const raw = readFileSync(oldPath, 'utf8');
    const parsed = matter(raw);
    const title = String(parsed.data.title || basename(file, '.md')).trim();
    const baseSlug = slugify(title);
    const slug = dedupeSlug(baseSlug, used);
    used.add(slug);

    plan.push({
      oldPath,
      newPath: join(POSTS_DIR, `${slug}.md`),
      oldFilename: file,
      newFilename: `${slug}.md`,
      title,
      isEmpty: parsed.content.trim().length === 0,
      tagsBefore: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
      tagsAfter: normalizeTags(parsed.data.tags),
    });
  }

  return plan;
}

function rewriteFrontmatter(plan: RenamePlan): string {
  const raw = readFileSync(plan.oldPath, 'utf8');
  const parsed = matter(raw);
  const frontmatter: Record<string, unknown> = {
    title: plan.title,
    slug: plan.newFilename.replace(/\.md$/, ''),
    date: parsed.data.date ?? new Date().toISOString(),
    ...(parsed.data.updated ? { updated: parsed.data.updated } : {}),
    tags: plan.tagsAfter,
    draft: plan.isEmpty,
    source: 'original',
  };
  const yamlStr = yaml.dump(frontmatter, { lineWidth: 200, quotingType: '"' });
  return `---\n${yamlStr}---\n${parsed.content}`;
}

function ensureBranch() {
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  if (branch === 'master' || branch === 'main') {
    throw new Error(`Refuse to run on ${branch}. Create a feature branch first.`);
  }
  console.log(`Branch: ${branch}`);
}

function main() {
  ensureBranch();
  const plan = buildPlan();

  console.log(`\nRename plan (${plan.length} files):\n`);
  console.log('OLD'.padEnd(50), '→', 'NEW');
  for (const p of plan) {
    const flag = p.isEmpty ? ' (DRAFT)' : '';
    console.log(p.oldFilename.padEnd(50), '→', p.newFilename + flag);
  }

  if (!APPLY) {
    console.log('\nDry run. Pass --apply to execute.');
    return;
  }

  // Ensure destination dir exists
  execSync(`mkdir -p ${POSTS_DIR}`);

  for (const p of plan) {
    const newContent = rewriteFrontmatter(p);
    // Write rewritten file at OLD location, then git mv
    writeFileSync(p.oldPath, newContent);
    execSync(`git mv "${p.oldPath}" "${p.newPath}"`);
  }

  console.log(`\nApplied ${plan.length} renames to src/content/posts/.`);
}

main();
```

- [ ] **Step 2: Add tsx + script entry to `package.json`**

In `package.json`, add to `"scripts"`:

```json
{
  "scripts": {
    "rename-to-slug": "tsx scripts/rename-to-slug.ts",
    "rename-to-slug:apply": "tsx scripts/rename-to-slug.ts --apply",
    "test": "vitest"
  }
}
```

(Keep any existing scripts Astro added.)

- [ ] **Step 3: Commit script (still no rename applied)**

```bash
git add scripts/rename-to-slug.ts package.json
git commit -m "feat(scripts): add rename-to-slug migration (dry-run by default)"
```

### Task 9: Dry-run on real 58 files

- [ ] **Step 1: Run dry-run, capture output**

```bash
pnpm rename-to-slug 2>&1 | tee /tmp/rename-plan.txt
```

Expected: prints the rename plan, ends with "Dry run. Pass --apply to execute."

- [ ] **Step 2: Inspect for collisions or surprises**

```bash
echo "Total renames:"
grep -c '→' /tmp/rename-plan.txt || true
echo ""
echo "Drafts (empty body):"
grep '(DRAFT)' /tmp/rename-plan.txt
echo ""
echo "Slug collisions (any line ending in -2.md, -3.md):"
grep -E '\->\s+.*-[0-9]+\.md' /tmp/rename-plan.txt
```

Expected: 58 renames, 1-2 drafts (`2025，技术狂飙，文明堕落.md` is 0 bytes and one other empty), 0 collisions ideally.

If unexpected collisions: investigate, fix `slugify` or `buildPlan`, re-run dry-run.

### Task 10: Apply rename + git mv

- [ ] **Step 1: Apply**

```bash
pnpm rename-to-slug:apply
```

Expected: prints same plan, ends with "Applied 58 renames to src/content/posts/."

- [ ] **Step 2: Verify all 58 in place**

```bash
ls src/content/posts/*.md | wc -l
ls *.md 2>/dev/null | wc -l
```

Expected: `58` posts in `src/content/posts/`, `0` left at repo root.

- [ ] **Step 3: Spot-check 3 random files**

```bash
for f in $(ls src/content/posts/*.md | shuf -n 3); do
  echo "=== $f ==="
  head -15 "$f"
  echo ""
done
```

Expected: each file has frontmatter with `title`, `slug`, `date`, `tags`, `draft`, `source`. Body intact below.

- [ ] **Step 4: Commit the renamed files**

```bash
git add -A
git commit -m "refactor: migrate 58 posts to src/content/posts/ with ASCII slugs

- Rename root *.md files to pinyin slugs via scripts/rename-to-slug.ts
- Preserve original Chinese titles in frontmatter
- Normalize tags (drop 'Notebooks/' prefix and the redundant 'blog' tag)
- Mark zero-body posts as draft: true
- Move all 58 files into src/content/posts/ via git mv"
```

### Task 11: Verify schema validates all 58 posts

- [ ] **Step 1: Run astro check**

```bash
pnpm astro check 2>&1 | tail -20
```

Expected: 0 errors. If errors (e.g. invalid date format), fix the offending posts manually, re-run.

- [ ] **Step 2: If errors found, list them and fix one at a time**

For each error:
1. Open the offending file.
2. Read the error (usually says which field).
3. Fix the field. Common fixes:
   - Date with quotes around malformed string: re-format to ISO 8601.
   - Title missing: read file, set to filename or first heading.
4. `pnpm astro check` again. Repeat until clean.

- [ ] **Step 3: Commit any fixes**

If fixes were needed:

```bash
git add src/content/posts/
git commit -m "fix(posts): adjust frontmatter on N posts to satisfy schema"
```

---

## Phase 3 — Theme: layouts and components

We're building the absolute minimum theme to render content. Polish comes later. Goal: site builds, posts render, navigation works, RSS valid.

### Task 12: BaseLayout component

**Files:**
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Write BaseLayout**

```astro
---
// src/layouts/BaseLayout.astro
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}

const { title, description = 'Lu Liu — personal blog and thoughts', ogImage } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
---
<!doctype html>
<html lang="zh-Hans">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:type" content="website" />
    {ogImage && <meta property="og:image" content={ogImage} />}
    <link rel="icon" href="/favicon.svg" />
    <link rel="alternate" type="application/rss+xml" title="luliu.me — posts" href="/rss.xml" />
    <link rel="alternate" type="application/rss+xml" title="luliu.me — thoughts" href="/thoughts/rss.xml" />
  </head>
  <body>
    <Header />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Commit (component will fail to import until Header/Footer exist; that's next task)**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat(theme): add BaseLayout with meta, RSS links"
```

### Task 13: Header + Footer components

**Files:**
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Header**

```astro
---
// src/components/Header.astro
const path = Astro.url.pathname;
const isActive = (p: string) => path === p || path.startsWith(p);
---
<header class="site-header">
  <a href="/" class="brand">luliu.me</a>
  <nav>
    <a href="/posts/" class:list={[{ active: isActive('/posts') }]}>Posts</a>
    <a href="/thoughts/" class:list={[{ active: isActive('/thoughts') }]}>Thoughts</a>
    <a href="/about/" class:list={[{ active: isActive('/about') }]}>About</a>
    <a href="/rss.xml" aria-label="RSS feed">RSS</a>
  </nav>
</header>
```

- [ ] **Step 2: Footer**

```astro
---
// src/components/Footer.astro
const year = new Date().getFullYear();
---
<footer class="site-footer">
  <p>© 2014–{year} Lu Liu. Built with Astro.</p>
</footer>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/
git commit -m "feat(theme): Header + Footer components"
```

### Task 14: Global CSS (system stack, light/dark, max-width)

**Files:**
- Create: `src/styles/global.css`

- [ ] **Step 1: Write CSS**

```css
/* src/styles/global.css */
:root {
  --max-width: 700px;
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #666666;
  --link: #0366d6;
  --border: #e1e4e8;
  --code-bg: #f6f8fa;
  --serif: 'Source Han Serif SC', 'Noto Serif CJK SC', Georgia, 'Times New Roman', serif;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --fg: #e1e4e8;
    --muted: #8b949e;
    --link: #58a6ff;
    --border: #30363d;
    --code-bg: #2d333b;
  }
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--serif);
  font-size: 18px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

main {
  max-width: var(--max-width);
  margin: 2rem auto;
  padding: 0 1.5rem;
}

a {
  color: var(--link);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--sans);
  line-height: 1.3;
}

code, pre {
  font-family: var(--mono);
  font-size: 0.92em;
  background: var(--code-bg);
  border-radius: 4px;
}

code {
  padding: 0.15em 0.35em;
}

pre {
  padding: 1rem;
  overflow-x: auto;
}

pre code {
  background: transparent;
  padding: 0;
}

img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1.5rem auto;
}

blockquote {
  border-left: 4px solid var(--border);
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  color: var(--muted);
}

.site-header {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  align-items: baseline;
  gap: 2rem;
  border-bottom: 1px solid var(--border);
}

.site-header .brand {
  font-family: var(--mono);
  font-weight: 600;
  font-size: 1.1rem;
}

.site-header nav {
  display: flex;
  gap: 1.5rem;
}

.site-header nav a {
  font-family: var(--sans);
  color: var(--fg);
  font-size: 0.95rem;
}

.site-header nav a.active {
  color: var(--link);
  font-weight: 600;
}

.site-footer {
  max-width: var(--max-width);
  margin: 4rem auto 2rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}

.post-meta {
  color: var(--muted);
  font-family: var(--sans);
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

.post-meta .tag {
  display: inline-block;
  padding: 0.1em 0.5em;
  margin-right: 0.4em;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 0.85em;
}

.post-list {
  list-style: none;
  padding: 0;
}

.post-list li {
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}

.post-list .post-date {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.85rem;
}

.post-list h2 {
  margin: 0.25em 0;
  font-size: 1.25rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/
git commit -m "feat(theme): global CSS — system stack, light/dark, 700px column"
```

### Task 15: Index page (landing)

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace contents**

```astro
---
// src/pages/index.astro
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';

const posts = (await getCollection('posts', ({ data }) => !data.draft))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
  .slice(0, 5);

const thoughts = (await getCollection('thoughts'))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
  .slice(0, 5);

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
---
<BaseLayout title="luliu.me">
  <section>
    <h1>Lu Liu</h1>
    <p>Personal blog, thoughts, and notes. Mostly in Chinese; sometimes in English.</p>
  </section>

  <section>
    <h2>Recent posts</h2>
    {posts.length === 0 && <p>(No posts yet.)</p>}
    <ul class="post-list">
      {posts.map((p) => (
        <li>
          <span class="post-date">{fmt(p.data.date)}</span>
          <h2><a href={`/posts/${p.data.slug ?? p.id}/`}>{p.data.title}</a></h2>
        </li>
      ))}
    </ul>
    <p><a href="/posts/">All posts →</a></p>
  </section>

  <section>
    <h2>Recent thoughts</h2>
    {thoughts.length === 0 && <p>(No thoughts yet.)</p>}
    <ul class="post-list">
      {thoughts.map((t) => (
        <li>
          <span class="post-date">{fmt(t.data.date)}</span>
          <p>{t.body.slice(0, 200)}{t.body.length > 200 ? '…' : ''}</p>
        </li>
      ))}
    </ul>
    <p><a href="/thoughts/">All thoughts →</a></p>
  </section>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(pages): landing — recent posts + thoughts"
```

### Task 16: Posts list page

**Files:**
- Create: `src/pages/posts/index.astro`

- [ ] **Step 1: Write**

```astro
---
// src/pages/posts/index.astro
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

const posts = (await getCollection('posts', ({ data }) => !data.draft))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
---
<BaseLayout title="Posts — luliu.me">
  <h1>Posts</h1>
  <p>{posts.length} posts.</p>
  <ul class="post-list">
    {posts.map((p) => (
      <li>
        <span class="post-date">{fmt(p.data.date)}</span>
        <h2><a href={`/posts/${p.data.slug ?? p.id}/`}>{p.data.title}</a></h2>
        {p.data.tags.length > 0 && (
          <p class="post-meta">
            {p.data.tags.map((t) => <span class="tag">{t}</span>)}
          </p>
        )}
      </li>
    ))}
  </ul>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/posts/index.astro
git commit -m "feat(pages): posts list"
```

### Task 17: Post detail page

**Files:**
- Create: `src/pages/posts/[...slug].astro`

- [ ] **Step 1: Write**

```astro
---
// src/pages/posts/[...slug].astro
import { type CollectionEntry, getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.data.slug ?? post.id },
    props: { post },
  }));
}

interface Props {
  post: CollectionEntry<'posts'>;
}

const { post } = Astro.props;
const { Content } = await render(post);

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
---
<BaseLayout title={`${post.data.title} — luliu.me`}>
  <article>
    <h1>{post.data.title}</h1>
    <p class="post-meta">
      <span>{fmt(post.data.date)}</span>
      {post.data.tags.length > 0 && <span> · </span>}
      {post.data.tags.map((t) => <span class="tag">{t}</span>)}
      {post.data.source === 'cnblogs' && post.data.sourceUrl && (
        <span> · <a href={post.data.sourceUrl}>原文 (cnblogs)</a></span>
      )}
    </p>
    <Content />
  </article>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/posts/
git commit -m "feat(pages): post detail with [...slug] dynamic route"
```

### Task 18: Thoughts list page

**Files:**
- Create: `src/pages/thoughts/index.astro`

- [ ] **Step 1: Write**

```astro
---
// src/pages/thoughts/index.astro
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

const thoughts = (await getCollection('thoughts'))
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

const rendered = await Promise.all(
  thoughts.map(async (t) => ({ entry: t, Content: (await render(t)).Content }))
);

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}
---
<BaseLayout title="Thoughts — luliu.me">
  <h1>Thoughts</h1>
  {thoughts.length === 0 && <p>(No thoughts yet — check back soon.)</p>}
  <div class="thoughts-feed">
    {rendered.map(({ entry, Content }) => {
      const anchor = entry.id.replace(/\.md$/, '');
      return (
        <section id={anchor} class="thought">
          <p class="post-meta">
            <a href={`#${anchor}`}>{fmtDate(entry.data.date)}</a>
            {entry.data.tags.map((t) => <span class="tag">{t}</span>)}
          </p>
          <Content />
        </section>
      );
    })}
  </div>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/thoughts/
git commit -m "feat(pages): thoughts feed"
```

### Task 19: Tag pages

**Files:**
- Create: `src/pages/tags/[tag].astro`

- [ ] **Step 1: Write**

```astro
---
// src/pages/tags/[tag].astro
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const tagMap = new Map<string, typeof posts>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(post);
    }
  }

  return Array.from(tagMap.entries()).map(([tag, postsForTag]) => ({
    params: { tag },
    props: {
      tag,
      posts: postsForTag.sort((a, b) => b.data.date.getTime() - a.data.date.getTime()),
    },
  }));
}

interface Props {
  tag: string;
  posts: Array<{ id: string; data: { title: string; date: Date; slug?: string } }>;
}

const { tag, posts } = Astro.props;

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
---
<BaseLayout title={`Tag: ${tag} — luliu.me`}>
  <h1>Tag: {tag}</h1>
  <p>{posts.length} post{posts.length === 1 ? '' : 's'}</p>
  <ul class="post-list">
    {posts.map((p) => (
      <li>
        <span class="post-date">{fmt(p.data.date)}</span>
        <h2><a href={`/posts/${p.data.slug ?? p.id}/`}>{p.data.title}</a></h2>
      </li>
    ))}
  </ul>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/tags/
git commit -m "feat(pages): tag pages"
```

### Task 20: About page

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Write**

```astro
---
// src/pages/about.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="About — luliu.me">
  <h1>About</h1>
  <p>I'm Lu Liu. Software engineer based in Heidelberg, Germany.</p>
  <p>This site holds my long-form posts and a stream of shorter thoughts. Mostly Chinese, sometimes English. The archive includes posts originally published on
  <a href="https://www.cnblogs.com/rib06">cnblogs</a> and consolidated here.</p>
  <p>Source code: <a href="https://github.com/tumluliu/blogs">github.com/tumluliu/blogs</a>.</p>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat(pages): about"
```

### Task 21: 404 page

**Files:**
- Create: `src/pages/404.astro`

- [ ] **Step 1: Write**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Not found — luliu.me">
  <h1>404</h1>
  <p>Page not found.</p>
  <p><a href="/">← Back to home</a></p>
</BaseLayout>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/404.astro
git commit -m "feat(pages): 404"
```

### Task 22: RSS feeds

**Files:**
- Create: `src/pages/rss.xml.ts`
- Create: `src/pages/thoughts/rss.xml.ts`

- [ ] **Step 1: Posts RSS**

```typescript
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: 'luliu.me — posts',
    description: 'Lu Liu — personal blog',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: '',
      link: `/posts/${p.data.slug ?? p.id}/`,
      categories: p.data.tags,
    })),
  });
}
```

- [ ] **Step 2: Thoughts RSS**

```typescript
// src/pages/thoughts/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const thoughts = (await getCollection('thoughts'))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: 'luliu.me — thoughts',
    description: 'Lu Liu — short thoughts',
    site: context.site!,
    items: thoughts.map((t) => ({
      title: t.data.date.toISOString().slice(0, 16).replace('T', ' '),
      pubDate: t.data.date,
      description: t.body.slice(0, 500),
      link: `/thoughts/#${t.id.replace(/\.md$/, '')}`,
      categories: t.data.tags,
    })),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/rss.xml.ts src/pages/thoughts/rss.xml.ts
git commit -m "feat(pages): RSS feeds for posts and thoughts"
```

---

## Phase 4 — Authoring helpers

### Task 23: `scripts/new-post.ts`

**Files:**
- Create: `scripts/new-post.ts`

- [ ] **Step 1: Write**

```typescript
// scripts/new-post.ts
//
// Usage: pnpm new-post "Post title here"
// Creates src/content/posts/<slug>.md with valid frontmatter, draft: true.

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { slugify } from './lib/slugify.js';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: pnpm new-post "Post title"');
  process.exit(1);
}

const slug = slugify(title);
const path = join('src', 'content', 'posts', `${slug}.md`);

if (existsSync(path)) {
  console.error(`File already exists: ${path}`);
  process.exit(1);
}

const now = new Date().toISOString();
const frontmatter = {
  title,
  slug,
  date: now,
  tags: [] as string[],
  draft: true,
  source: 'original',
};

const content = `---\n${yaml.dump(frontmatter, { lineWidth: 200 })}---\n\n`;
writeFileSync(path, content);
console.log(`Created ${path}`);
```

### Task 24: `scripts/new-thought.ts`

**Files:**
- Create: `scripts/new-thought.ts`

- [ ] **Step 1: Write**

```typescript
// scripts/new-thought.ts
//
// Usage: pnpm new-thought
// Creates src/content/thoughts/YYYY-MM-DD-HHmm.md with frontmatter and an empty body.

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const now = new Date();
const pad = (n: number) => n.toString().padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const path = join('src', 'content', 'thoughts', `${stamp}.md`);

if (existsSync(path)) {
  console.error(`File already exists: ${path}`);
  process.exit(1);
}

const frontmatter = {
  date: now.toISOString(),
  tags: [] as string[],
};

const content = `---\n${yaml.dump(frontmatter, { lineWidth: 200 })}---\n\n`;
writeFileSync(path, content);
console.log(`Created ${path}`);
```

- [ ] **Step 2: Wire up scripts in `package.json`**

Add to `"scripts"`:

```json
{
  "scripts": {
    "new-post": "tsx scripts/new-post.ts",
    "new-thought": "tsx scripts/new-thought.ts"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/new-post.ts scripts/new-thought.ts package.json
git commit -m "feat(scripts): add new-post and new-thought CLI helpers"
```

### Task 25: Smoke-test the new-* scripts

- [ ] **Step 1: Create a temporary new post**

```bash
pnpm new-post "Smoke test post — delete me"
ls src/content/posts/smoke-test-post-delete-me.md && head src/content/posts/smoke-test-post-delete-me.md
```

Expected: file exists, has valid frontmatter (`title`, `slug`, `date`, `tags`, `draft: true`, `source: original`).

- [ ] **Step 2: Create a temporary new thought**

```bash
pnpm new-thought
ls src/content/thoughts/*.md
```

Expected: one file with timestamp filename, valid frontmatter.

- [ ] **Step 3: Confirm schema accepts both**

```bash
pnpm astro check 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 4: Delete the smoke-test files**

```bash
rm src/content/posts/smoke-test-post-delete-me.md
rm src/content/thoughts/*.md  # only smoke test was here
```

(Don't commit the smoke-test artifacts.)

---

## Phase 5 — Build and preview

### Task 26: Full production build

- [ ] **Step 1: Build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: ends with "Complete!" or similar success line. `dist/` directory created.

- [ ] **Step 2: Verify built artifacts**

```bash
test -f dist/index.html && echo "index OK"
test -f dist/posts/index.html && echo "posts list OK"
test -f dist/rss.xml && echo "rss OK"
test -f dist/thoughts/rss.xml && echo "thoughts rss OK"
test -f dist/sitemap-index.xml && echo "sitemap OK"
test -f dist/404.html && echo "404 OK"
test -f dist/about/index.html && echo "about OK"
echo ""
echo "Generated post pages:"
find dist/posts -name index.html | wc -l
echo ""
echo "Generated tag pages:"
find dist/tags -name '*.html' | wc -l 2>/dev/null || echo 0
```

Expected:
- All `OK` lines printed.
- ~57 post pages (58 minus the 1 draft for empty body).
- Some number of tag pages (depends on tag distribution).

### Task 27: Preview locally and spot-check

- [ ] **Step 1: Start preview server**

```bash
pnpm preview &
PREVIEW_PID=$!
sleep 3
curl -sI http://localhost:4321/ | head -1
```

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 2: Curl-spot-check 5 URLs**

```bash
for url in / /posts/ /thoughts/ /about/ /rss.xml; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321$url")
  echo "$url → $code"
done
```

Expected: all `200`.

- [ ] **Step 3: Test 3 random post URLs**

```bash
for slug in $(ls src/content/posts/*.md | head -3 | xargs -I{} basename {} .md); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4321/posts/$slug/")
  echo "/posts/$slug/ → $code"
done
```

Expected: all `200`.

- [ ] **Step 4: Open the site in your browser, scroll**

Visit `http://localhost:4321/` manually. Click into a few posts. Confirm:
- Layout reads cleanly.
- Chinese characters render with serif font.
- Code blocks render with syntax highlighting.
- Light/dark mode follows system preference.
- Tag links work.

- [ ] **Step 5: Stop preview**

```bash
kill $PREVIEW_PID 2>/dev/null
wait 2>/dev/null
```

### Task 28: Final verification gate

- [ ] **Step 1: Confirm clean state**

```bash
git status
```

Expected: clean working tree (all changes committed).

- [ ] **Step 2: Test suite still passes**

```bash
pnpm test --run 2>&1 | tail -10
```

Expected: 12 tests passed (8 slugify + 4 dedupe-slug).

- [ ] **Step 3: Astro check final**

```bash
pnpm astro check 2>&1 | tail -5
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Production build final**

```bash
pnpm build 2>&1 | grep -E '(✓|error|warn)' | tail -10
echo "Pages built: $(find dist -name '*.html' | wc -l)"
```

Expected: build succeeds, page count > 60 (57 posts + index + posts list + thoughts + about + 404 + tag pages).

- [ ] **Step 5: Sign-off note**

Add a line to your scratchpad / project notes:

```
Plan B complete: 2026-05-05
Astro site building locally with all 58 posts validated by schema.
Cleared to start Plan C (cnblogs aggregation).
```

---

## Done

When all tasks above are checked, Plan B is complete. You have:

1. Astro 5 project scaffolded in repo root.
2. Content collections (`posts`, `thoughts`) with Zod schemas.
3. 58 original posts renamed to ASCII slugs and moved into `src/content/posts/`.
4. Minimal theme: BaseLayout, Header, Footer, light/dark CSS.
5. Pages: `/`, `/posts/`, `/posts/<slug>/`, `/thoughts/`, `/tags/<tag>/`, `/about/`, `/404`, `/rss.xml`, `/thoughts/rss.xml`, `/sitemap-index.xml`.
6. CLI scripts: `pnpm new-post`, `pnpm new-thought`, `pnpm rename-to-slug`.
7. Test suite (`pnpm test`) green.
8. `pnpm build` produces a complete `dist/` ready to deploy.

VM is still untouched. Live luliu.me is still serving the old Hexo site.

**Next:** request Plan C (cnblogs import of 164 archived posts) — or skip ahead to Plan D (VM rebuild + cutover) if you want to ship the migration before adding cnblogs.
