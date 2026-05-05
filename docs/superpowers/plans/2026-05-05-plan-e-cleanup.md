# Plan E — Cleanup Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the theme polish iterated on branch `plan-e-theme-polish`, fix pandoc paragraph-break artefacts across the 166 cnblogs imports with an idempotent TDD script, and bump GitHub Actions versions to clear the Node 20 deprecation warning.

**Architecture:** Three independent workstreams in one plan: (1) merge the visual-polish branch to master, (2) add a pure-function paragraph-fix module under `scripts/lib/` plus a CLI wrapper under `scripts/cnblogs/`, exercised with vitest tests and applied to all `source: cnblogs` posts, (3) bump pinned action versions in `.github/workflows/deploy.yml`. Each phase is independently shippable and verifiable.

**Tech Stack:** Astro 6.2, TypeScript, tsx, vitest 4, GitHub Actions, plain CSS, gray-matter for frontmatter parsing.

---

## File Structure

**Created:**
- `scripts/lib/pandoc-paragraph-fix.ts` — pure logic: block splitter, backslash strip, paragraph merge, top-level `fixContent` orchestrator
- `scripts/lib/pandoc-paragraph-fix.test.ts` — vitest suite covering every branch of the algorithm
- `scripts/cnblogs/fix-pandoc-paragraphs.ts` — CLI wrapper: walks `src/content/posts/*.md`, filters by `source: cnblogs`, dry-runs by default, `--apply` writes changes, `--slug=<x>` targets one file
- `docs/superpowers/specs/2026-05-05-plan-e-cleanup-design.md` — already exists (the spec)

**Modified:**
- `.github/workflows/deploy.yml` — bump pinned action versions
- `package.json` — add three pnpm scripts for the new fix tool
- `src/content/posts/<slug>.md` × 166 — paragraph-fix script writes here in §2 Task 12

**Already in place** (on `plan-e-theme-polish` branch, untouched by this plan):
- `src/styles/global.css` — full theme rewrite
- `src/components/Header.astro` — title brand + nav + theme toggle button + inline JS
- `src/components/Footer.astro` — byline 2005-YYYY
- `src/layouts/BaseLayout.astro` — pre-paint script for theme-flash avoidance
- `src/pages/index.astro` — hero with avatar + one-line poem + section heads
- `src/pages/posts/index.astro` — yearly archive grouping
- `src/pages/tags/index.astro` — new tag-cloud index
- `public/images/avatar.png` — 100 KB avatar copied from VM backup

---

## Phase 1 — §1 visual polish: review and ship

### Task 1: Audit branch state vs spec

**Files:**
- Read-only review of `plan-e-theme-polish` branch (currently checked out)

- [ ] **Step 1: Confirm branch + working tree clean**

```bash
git branch --show-current
git status --short
```

Expected: branch is `plan-e-theme-polish`. Working tree clean (no uncommitted changes; the spec commit is the latest).

- [ ] **Step 2: List branch commits since master**

```bash
git log --oneline master..HEAD
```

Expected: at least one commit per visual change (CSS rewrite, header, footer, hero, posts index, tags index, theme toggle, footer year, avatar, hero poem one-line, etc.) plus the spec commit at the top.

- [ ] **Step 3: Confirm files listed in spec §1 are present and modified**

```bash
for f in src/styles/global.css src/components/Header.astro src/components/Footer.astro src/layouts/BaseLayout.astro src/pages/index.astro src/pages/posts/index.astro src/pages/tags/index.astro public/images/avatar.png; do
  test -e "$f" && echo "OK $f" || echo "MISSING $f"
done
```

Expected: all eight rows print `OK`.

- [ ] **Step 4: Build green**

```bash
pnpm build 2>&1 | tail -3
```

Expected: `Complete!` and at least 248 pages built.

### Task 2: Manual smoke check on dev server

**Files:** none (browser inspection)

- [ ] **Step 1: Stop any zombie dev servers**

```bash
pkill -f "astro dev" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1
lsof -nP -iTCP:4321 -sTCP:LISTEN 2>&1 | head -2 || echo "4321 free"
```

Expected: `4321 free`.

- [ ] **Step 2: Start dev**

```bash
pnpm dev &
sleep 4
```

Expected: dev server listening on http://localhost:4321/.

- [ ] **Step 3: Inspect each route in browser**

Visit each in turn:
1. `http://localhost:4321/` — avatar circle + one-line poem; section heads `Recent posts → All posts`, `Recent thoughts → All thoughts`.
2. `http://localhost:4321/posts/` — year headings (2026, 2025, ..., descending), MM-DD date column.
3. `http://localhost:4321/tags/` — tag cloud chips with counts.
4. `http://localhost:4321/tags/MIS/` — per-tag detail (existing).
5. `http://localhost:4321/posts/kong-jian-ji-yi-zhi-neng-xi-tong-que-shi-de-ren-zhi-di-zuo/` — long post with images.
6. `http://localhost:4321/about/` — about page.
7. `http://localhost:4321/this-does-not-exist/` — 404 page.

For each, click the ☀/☾ toggle in nav; cycle auto → dark → light → auto. Reload after each change; confirm no flash.

Expected: all routes render cleanly. Theme toggle persists across reloads. Dark and light both readable.

- [ ] **Step 4: Stop dev server**

```bash
pkill -f "astro dev" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1
```

Expected: ports free again.

### Task 3: Merge to master and push

**Files:**
- `master` (fast-forward target)

- [ ] **Step 1: Switch to master**

```bash
git checkout master
git status --short
```

Expected: on master, working tree clean (workspace.json may show; ignore).

- [ ] **Step 2: Fast-forward merge**

```bash
git merge --ff-only plan-e-theme-polish 2>&1 | tail -3
```

Expected: `Fast-forward` summary listing changed files, no merge commit.

- [ ] **Step 3: Push and trigger deploy**

```bash
git push origin master 2>&1 | tail -3
```

Expected: `master -> master` push line.

- [ ] **Step 4: Watch the deploy**

```bash
sleep 8
gh run list --workflow=deploy.yml --limit 1
```

Get the run ID, then:

```bash
gh run watch <RUN_ID> --exit-status 2>&1 | tail -3
```

Expected: `completed with 'success'`.

- [ ] **Step 5: Verify on luliu.me**

```bash
curl -sI https://luliu.me/ | head -3
curl -s https://luliu.me/tags/ -o /dev/null -w '/tags/: %{http_code}\n'
curl -s https://luliu.me/posts/ -o /dev/null -w '/posts/: %{http_code}\n'
```

Expected: apex 200, `/tags/: 200` (was 404 before — index page now exists), `/posts/: 200`.

User opens https://luliu.me/ in their browser and confirms hero + theme toggle are live as designed.

---

## Phase 2 — §2 pandoc paragraph-break fix

### Task 4: Set up the pure-logic module skeleton

**Files:**
- Create: `scripts/lib/pandoc-paragraph-fix.ts`
- Create: `scripts/lib/pandoc-paragraph-fix.test.ts`

- [ ] **Step 1: Write a failing smoke test**

Create `scripts/lib/pandoc-paragraph-fix.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { fixContent } from './pandoc-paragraph-fix.js';

describe('fixContent', () => {
  it('returns input unchanged when there is nothing to fix', () => {
    const input = '一段完整的中文。\n\n第二段。\n';
    expect(fixContent(input)).toBe(input);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: FAIL with module-not-found / `fixContent` not exported.

- [ ] **Step 3: Write the minimal stub**

Create `scripts/lib/pandoc-paragraph-fix.ts`:

```typescript
export function fixContent(input: string): string {
  return input;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -5
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/pandoc-paragraph-fix.ts scripts/lib/pandoc-paragraph-fix.test.ts
git commit -m "scripts(lib): scaffold pandoc-paragraph-fix module"
```

### Task 5: Backslash strip — TDD

**Files:**
- Modify: `scripts/lib/pandoc-paragraph-fix.test.ts`
- Modify: `scripts/lib/pandoc-paragraph-fix.ts`

- [ ] **Step 1: Add failing tests for `stripBackslashes`**

Append to `scripts/lib/pandoc-paragraph-fix.test.ts`:

```typescript
import { stripBackslashes } from './pandoc-paragraph-fix.js';

describe('stripBackslashes', () => {
  it('removes trailing \\ on prose lines', () => {
    expect(stripBackslashes('一段中文\\\n\\\n下一段。')).toBe('一段中文\n\n下一段。');
  });

  it('removes trailing \\ at end of file', () => {
    expect(stripBackslashes('结尾\\')).toBe('结尾');
  });

  it('preserves \\ inside fenced code blocks', () => {
    const input = '```bash\necho foo\\\nbar\n```';
    expect(stripBackslashes(input)).toBe(input);
  });

  it('handles empty input', () => {
    expect(stripBackslashes('')).toBe('');
  });

  it('does not strip \\ that is not at end of line', () => {
    expect(stripBackslashes('foo \\ bar')).toBe('foo \\ bar');
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: 5 fails on `stripBackslashes` (not exported).

- [ ] **Step 3: Implement `stripBackslashes`**

Append to `scripts/lib/pandoc-paragraph-fix.ts`:

```typescript
const FENCE_RE = /^```/;

export function stripBackslashes(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(line.replace(/\s*\\$/, ''));
  }
  return out.join('\n');
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -5
```

Expected: 6 passed total (1 original + 5 new).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/pandoc-paragraph-fix.ts scripts/lib/pandoc-paragraph-fix.test.ts
git commit -m "scripts(lib): stripBackslashes drops pandoc hard-break markers outside code"
```

### Task 6: Block splitter — TDD

**Files:**
- Modify: `scripts/lib/pandoc-paragraph-fix.test.ts`
- Modify: `scripts/lib/pandoc-paragraph-fix.ts`

- [ ] **Step 1: Add failing tests for `splitBlocks`**

Append to `scripts/lib/pandoc-paragraph-fix.test.ts`:

```typescript
import { splitBlocks, type Block } from './pandoc-paragraph-fix.js';

describe('splitBlocks', () => {
  it('splits two paragraphs', () => {
    const blocks = splitBlocks('a\n\nb');
    expect(blocks).toEqual<Block[]>([
      { kind: 'prose', text: 'a' },
      { kind: 'prose', text: 'b' },
    ]);
  });

  it('typed block: heading', () => {
    const blocks = splitBlocks('# Title\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'heading', text: '# Title' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: list', () => {
    const blocks = splitBlocks('- one\n- two\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'list', text: '- one\n- two' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: blockquote', () => {
    const blocks = splitBlocks('> quote\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'quote', text: '> quote' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: hr', () => {
    const blocks = splitBlocks('---\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'hr', text: '---' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: image-only', () => {
    const blocks = splitBlocks('![alt](/x.png)\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'image', text: '![alt](/x.png)' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: code fence preserves blank lines and content', () => {
    const blocks = splitBlocks('```js\nconst x = 1;\n\nconst y = 2;\n```\n\nafter');
    expect(blocks).toEqual<Block[]>([
      { kind: 'code', text: '```js\nconst x = 1;\n\nconst y = 2;\n```' },
      { kind: 'prose', text: 'after' },
    ]);
  });

  it('typed block: html', () => {
    const blocks = splitBlocks('<div>x</div>\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'html', text: '<div>x</div>' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('table block', () => {
    const blocks = splitBlocks('| a | b |\n| - | - |\n| 1 | 2 |\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'table', text: '| a | b |\n| - | - |\n| 1 | 2 |' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('multi-line prose paragraph stays as one block', () => {
    const blocks = splitBlocks('line one\nline two\n\nnext');
    expect(blocks).toEqual<Block[]>([
      { kind: 'prose', text: 'line one\nline two' },
      { kind: 'prose', text: 'next' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: 10 fails on `splitBlocks` / `Block` not exported.

- [ ] **Step 3: Implement `splitBlocks` and the `Block` type**

Append to `scripts/lib/pandoc-paragraph-fix.ts`:

```typescript
export type BlockKind = 'prose' | 'heading' | 'list' | 'quote' | 'code' | 'table' | 'image' | 'html' | 'hr';

export interface Block {
  kind: BlockKind;
  text: string;
}

const HEADING_RE = /^#{1,6}\s/;
const LIST_RE = /^(\s*)([-*+]|\d+\.)\s/;
const QUOTE_RE = /^>\s?/;
const HR_RE = /^(\s*)([-*_])\1?\2?\s*\2?\s*\2?\s*$/; // 3+ of same char, optional spaces
const HR_SIMPLE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_ONLY_RE = /^!\[[^\]]*\]\([^)]+\)\s*$/;
const HTML_RE = /^<[a-zA-Z!]/;
const TABLE_RE = /^\s*\|/;
const FENCE_RE = /^```/;

function detectKind(line: string): BlockKind {
  if (HEADING_RE.test(line)) return 'heading';
  if (LIST_RE.test(line)) return 'list';
  if (QUOTE_RE.test(line)) return 'quote';
  if (HR_SIMPLE.test(line)) return 'hr';
  if (IMAGE_ONLY_RE.test(line)) return 'image';
  if (HTML_RE.test(line)) return 'html';
  if (TABLE_RE.test(line)) return 'table';
  return 'prose';
}

export function splitBlocks(input: string): Block[] {
  const lines = input.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    // Skip leading blank lines.
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    // Code fence: capture up to the matching closing fence.
    if (FENCE_RE.test(lines[i])) {
      const start = i;
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) i++;
      if (i < lines.length) i++; // include closing fence
      blocks.push({ kind: 'code', text: lines.slice(start, i).join('\n') });
      continue;
    }

    const kind = detectKind(lines[i]);
    const start = i;

    if (kind === 'hr' || kind === 'image') {
      // Single-line block.
      blocks.push({ kind, text: lines[i] });
      i++;
      continue;
    }

    // Multi-line block: consume lines of the same kind until blank line.
    while (i < lines.length && lines[i].trim() !== '') {
      // For prose, allow continuation of any non-block-starter that isn't a different kind.
      if (i > start) {
        const k = detectKind(lines[i]);
        if (k !== kind && !(kind === 'prose' && k === 'prose')) break;
      }
      i++;
    }

    blocks.push({ kind, text: lines.slice(start, i).join('\n') });
  }

  return blocks;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: 16 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/pandoc-paragraph-fix.ts scripts/lib/pandoc-paragraph-fix.test.ts
git commit -m "scripts(lib): block-aware splitter with typed Block kinds"
```

### Task 7: Paragraph merge — TDD

**Files:**
- Modify: `scripts/lib/pandoc-paragraph-fix.test.ts`
- Modify: `scripts/lib/pandoc-paragraph-fix.ts`

- [ ] **Step 1: Add failing tests for `mergeParagraphs`**

Append to `scripts/lib/pandoc-paragraph-fix.test.ts`:

```typescript
import { mergeParagraphs } from './pandoc-paragraph-fix.js';

describe('mergeParagraphs', () => {
  it('merges three CJK / ASCII / CJK blocks into one when sentence is mid-flow', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS' },
      { kind: 'prose', text: '项目。' },
      { kind: 'prose', text: '下一段从这里开始。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS项目。');
    expect(out[1].text).toBe('下一段从这里开始。');
  });

  it('inserts a space when merging English to English at word boundary', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: 'continued from the' },
      { kind: 'prose', text: 'previous line.' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('continued from the previous line.');
  });

  it('does NOT merge when first paragraph ends with terminator', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '完整的句子。' },
      { kind: 'prose', text: '另一段。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
  });

  it('does NOT merge across heading', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '未完句子' },
      { kind: 'heading', text: '## 新章节' },
      { kind: 'prose', text: '继续。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(3);
  });

  it('does NOT merge across image-only paragraph', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '看下图' },
      { kind: 'image', text: '![](/x.png)' },
      { kind: 'prose', text: '说明文字。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(3);
  });

  it('treats colon as terminator (often introduces list/quote)', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '有以下几点：' },
      { kind: 'prose', text: '第一点。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
  });

  it('treats Chinese closing 」 as terminator', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '他说「这是好事」' },
      { kind: 'prose', text: '然后离开了。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
  });

  it('chain-merges multiple short paragraphs until terminator', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: 'foo' },
      { kind: 'prose', text: 'bar' },
      { kind: 'prose', text: 'baz.' },
      { kind: 'prose', text: 'next.' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('foo bar baz.');
    expect(out[1].text).toBe('next.');
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: 8 fails on `mergeParagraphs` not exported.

- [ ] **Step 3: Implement `mergeParagraphs`**

Append to `scripts/lib/pandoc-paragraph-fix.ts`:

```typescript
const TERMINATORS = new Set([
  '。', '.', '！', '!', '？', '?', '…', ';', '；', ':', '：',
  '」', '』', '"', "'", ')', '）', ']', '】', '>',
]);

function lastVisibleChar(s: string): string {
  const trimmed = s.replace(/\s+$/, '');
  return trimmed.charAt(trimmed.length - 1);
}

function isWordChar(c: string): boolean {
  return /[A-Za-z0-9]/.test(c);
}

function joinText(a: string, b: string): string {
  const aLast = lastVisibleChar(a);
  const bFirst = b.trimStart().charAt(0);
  // Insert a space when concatenating two ASCII word characters; CJK needs none.
  if (isWordChar(aLast) && isWordChar(bFirst)) return a + ' ' + b;
  return a + b;
}

export function mergeParagraphs(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < blocks.length) {
    const cur = blocks[i];
    if (cur.kind !== 'prose') {
      out.push(cur);
      i++;
      continue;
    }
    let merged = cur.text;
    let j = i + 1;
    while (j < blocks.length) {
      const last = lastVisibleChar(merged);
      if (TERMINATORS.has(last)) break;
      const next = blocks[j];
      if (next.kind !== 'prose') break;
      merged = joinText(merged, next.text);
      j++;
    }
    out.push({ kind: 'prose', text: merged });
    i = j;
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: 24 passed total.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/pandoc-paragraph-fix.ts scripts/lib/pandoc-paragraph-fix.test.ts
git commit -m "scripts(lib): mergeParagraphs chain-merges mid-flow prose blocks"
```

### Task 8: Wire `fixContent` and verify idempotence

**Files:**
- Modify: `scripts/lib/pandoc-paragraph-fix.test.ts`
- Modify: `scripts/lib/pandoc-paragraph-fix.ts`

- [ ] **Step 1: Add failing integration + idempotence tests**

Append to `scripts/lib/pandoc-paragraph-fix.test.ts`:

```typescript
describe('fixContent (integration)', () => {
  it('fixes the dao-tui-style mid-sentence break', () => {
    const input = [
      '---',
      'title: x',
      '---',
      '',
      '本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS\\',
      '\\',
      '项目。\\',
      '\\',
      '下一段从这里开始。',
      '',
    ].join('\n');
    const expected = [
      '---',
      'title: x',
      '---',
      '',
      '本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS项目。',
      '',
      '下一段从这里开始。',
      '',
    ].join('\n');
    expect(fixContent(input)).toBe(expected);
  });

  it('preserves frontmatter verbatim', () => {
    const fm = '---\ntitle: x\nslug: y\ndate: "2025-01-01"\ntags:\n  - a\n  - b\n---\n\n';
    const body = '一段。\n';
    expect(fixContent(fm + body)).toBe(fm + body);
  });

  it('preserves fenced code verbatim', () => {
    const input = '前文\\\n\\\n```js\nconst x = 1;\n\nconst y = 2;\n```\n\n后文。\n';
    const out = fixContent(input);
    expect(out).toContain('```js\nconst x = 1;\n\nconst y = 2;\n```');
  });

  it('is idempotent: running twice = running once', () => {
    const input = '一段中文MIS\\\n\\\n项目。\\\n\\\n下一段。\n';
    const once = fixContent(input);
    const twice = fixContent(once);
    expect(twice).toBe(once);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -15
```

Expected: 4 fails (current `fixContent` is identity stub).

- [ ] **Step 3: Replace stub `fixContent` with the orchestrator**

Replace the existing `fixContent` body in `scripts/lib/pandoc-paragraph-fix.ts`:

```typescript
function splitFrontmatter(input: string): { frontmatter: string; body: string } {
  const m = input.match(/^---\n[\s\S]*?\n---\n?/);
  if (!m) return { frontmatter: '', body: input };
  return { frontmatter: m[0], body: input.slice(m[0].length) };
}

function renderBlocks(blocks: Block[]): string {
  return blocks.map((b) => b.text).join('\n\n');
}

export function fixContent(input: string): string {
  const { frontmatter, body } = splitFrontmatter(input);
  const stripped = stripBackslashes(body);
  const blocks = splitBlocks(stripped);
  const merged = mergeParagraphs(blocks);
  const rendered = renderBlocks(merged);
  // Preserve trailing newline if input had one.
  const trailing = input.endsWith('\n') ? '\n' : '';
  return frontmatter + (rendered ? rendered + trailing : trailing);
}
```

- [ ] **Step 4: Run all tests**

```bash
pnpm vitest run scripts/lib/pandoc-paragraph-fix.test.ts 2>&1 | tail -10
```

Expected: 28 passed total.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/pandoc-paragraph-fix.ts scripts/lib/pandoc-paragraph-fix.test.ts
git commit -m "scripts(lib): wire fixContent — strip + split + merge + render, idempotent"
```

### Task 9: CLI wrapper with dry-run / --apply / --slug

**Files:**
- Create: `scripts/cnblogs/fix-pandoc-paragraphs.ts`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Write the CLI script**

Create `scripts/cnblogs/fix-pandoc-paragraphs.ts`:

```typescript
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
  // Cheap frontmatter check; avoids pulling gray-matter for one bool.
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
  let cnblogs = 0;
  let changed = 0;
  let totalBeforeBytes = 0;
  let totalAfterBytes = 0;

  for (const f of targets) {
    const path = join(POSTS_DIR, f);
    const s = processFile(path);
    scanned++;
    totalBeforeBytes += s.bytesBefore;
    totalAfterBytes += s.bytesAfter;
    if (s.bytesBefore !== s.bytesAfter || s.changed) cnblogs++;
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
```

- [ ] **Step 2: Add pnpm scripts**

Modify `package.json` to add three lines under `"scripts"` (between `"cnblogs:images"` and the closing brace of `scripts`):

```json
"cnblogs:fix-paragraphs": "tsx scripts/cnblogs/fix-pandoc-paragraphs.ts",
"cnblogs:fix-paragraphs:apply": "tsx scripts/cnblogs/fix-pandoc-paragraphs.ts --apply",
```

- [ ] **Step 3: Smoke-test the CLI in dry-run mode on the user-flagged post**

```bash
pnpm tsx scripts/cnblogs/fix-pandoc-paragraphs.ts --slug=dao-tui-de-li-shi-mou-mis-xiang-mu-shou-ji-1-qie-wu-hua-rou 2>&1 | tail -10
```

Expected: prints `WOULD <slug> bytes A → B`, then summary `Mode: DRY-RUN, Scanned: 1, Changed: 1`, no file write.

- [ ] **Step 4: Verify no file change happened**

```bash
git status --short scripts/ src/content/posts/dao-tui-de-li-shi-mou-mis-xiang-mu-shou-ji-1-qie-wu-hua-rou.md
```

Expected: only `scripts/cnblogs/fix-pandoc-paragraphs.ts` shows up; the post md is untouched (no `M` line for it).

- [ ] **Step 5: Commit the CLI**

```bash
git add scripts/cnblogs/fix-pandoc-paragraphs.ts package.json
git commit -m "scripts(cnblogs): CLI to fix-pandoc-paragraphs across cnblogs imports"
```

### Task 10: Dry-run on full corpus, review

**Files:** none modified

- [ ] **Step 1: Run dry-run on all posts**

```bash
pnpm cnblogs:fix-paragraphs 2>&1 | tee /tmp/plan-e-pandoc-dryrun.log | tail -30
```

Expected: `Mode: DRY-RUN`, scanned 220+ posts, changed count > 0 (at least the one user flagged plus more).

- [ ] **Step 2: Sanity-check the diff for a sample of 3 changed posts**

For three slugs from the WOULD list (pick one short, one medium, one long), do a focused dry-run + manual diff. Example for one slug:

```bash
slug=dao-tui-de-li-shi-mou-mis-xiang-mu-shou-ji-1-qie-wu-hua-rou
diff <(cat src/content/posts/$slug.md) <(pnpm tsx -e "
import {readFileSync} from 'node:fs';
import {fixContent} from './scripts/lib/pandoc-paragraph-fix.js';
process.stdout.write(fixContent(readFileSync('src/content/posts/$slug.md','utf8')));
" 2>/dev/null) | head -40
```

Expected: only paragraph-merging diffs (no content lost; no headings/lists/code/images mangled).

If a sample looks wrong, stop and refine the algorithm before applying.

### Task 11: Apply, build, deploy

**Files:**
- Modify: many under `src/content/posts/*.md` (script writes)

- [ ] **Step 1: Apply**

```bash
pnpm cnblogs:fix-paragraphs:apply 2>&1 | tail -30
```

Expected: `Mode: APPLY`, same change count as previous dry-run.

- [ ] **Step 2: Inspect git diff scope**

```bash
git status --short src/content/posts/ | head -20
git diff --shortstat src/content/posts/
```

Expected: `M ` lines for several posts; shortstat shows sensible insertion/deletion counts (~1-1 ratio on prose joins).

- [ ] **Step 3: Spot-check user-flagged post in browser**

```bash
pkill -f "astro dev" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1
pnpm dev &
sleep 4
```

Open `http://localhost:4321/posts/dao-tui-de-li-shi-mou-mis-xiang-mu-shou-ji-1-qie-wu-hua-rou/` — sentences should flow continuously without mid-paragraph English/numeric breaks.

```bash
pkill -f "astro dev" 2>/dev/null; pkill -f vite 2>/dev/null; sleep 1
```

- [ ] **Step 4: Build to verify content schema still valid**

```bash
pnpm build 2>&1 | tail -3
```

Expected: 248+ pages, `Complete!`. No schema errors.

- [ ] **Step 5: Run vitest one more time to confirm no regressions**

```bash
pnpm vitest run 2>&1 | tail -10
```

Expected: all tests green (slugify 8, dedupeSlug 4, pandoc-paragraph-fix 28 → 40 total).

- [ ] **Step 6: Commit**

```bash
git add src/content/posts/
git commit -m "$(cat <<'EOF'
fix(cnblogs): merge pandoc-broken mid-sentence paragraphs

Applies scripts/cnblogs/fix-pandoc-paragraphs.ts across all source:
cnblogs imports. Fixes the artefact where Word-pasted HTML produced
spurious paragraph breaks around English/numeric runs (e.g. ...一个MIS
\n\n项目。 → ...一个MIS项目。). Idempotent; conservative terminator
heuristic; manual diff spot-checks confirmed no over-merge on sampled
posts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Push and watch deploy**

```bash
git push origin master 2>&1 | tail -3
sleep 8
gh run list --workflow=deploy.yml --limit 1
```

Get the run ID, then `gh run watch <RUN_ID> --exit-status 2>&1 | tail -3`.

Expected: success.

---

## Phase 3 — §3 Node 24 bump

### Task 12: Bump action versions, push, verify warning gone

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Verify v5 is available for the three actions**

```bash
gh api repos/actions/checkout/releases/latest --jq .tag_name
gh api repos/actions/setup-node/releases/latest --jq .tag_name
gh api repos/pnpm/action-setup/releases/latest --jq .tag_name
```

Expected: tags ≥ v5.0.0 for actions/checkout and actions/setup-node. pnpm/action-setup may still be v4 (its v5 may not exist at edit time); record which is which.

- [ ] **Step 2: Edit the workflow**

In `.github/workflows/deploy.yml`, change:

```yaml
- uses: actions/checkout@v4
```

to:

```yaml
- uses: actions/checkout@v5
```

Same for `actions/setup-node@v4` → `actions/setup-node@v5`.

If `pnpm/action-setup` v5 was confirmed in Step 1, bump that too. Otherwise leave at v4 and add `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` at the workflow level (sibling of `on:` and `jobs:`):

```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'
```

Keep `node-version: 22` for the build job (separate concern).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: bump GH Actions to Node-24-compatible versions"
```

- [ ] **Step 4: Push and watch the deploy**

```bash
git push origin master 2>&1 | tail -3
sleep 8
gh run list --workflow=deploy.yml --limit 1
```

Get the run ID. Then:

```bash
gh run view <RUN_ID> --log 2>&1 | grep -i "deprecat" | head -5 || echo "no deprecation warnings"
```

Expected: `no deprecation warnings`. The previous warning text about Node 20 actions should NOT appear.

- [ ] **Step 5: Confirm site still builds and deploys**

```bash
gh run watch <RUN_ID> --exit-status 2>&1 | tail -3
curl -sI https://luliu.me/ | head -3
```

Expected: deploy succeeds; apex still 200.

---

## Phase 4 — Acceptance

### Task 13: Final cross-section verification

**Files:** none

- [ ] **Step 1: Visual (§1) — live site check**

Open https://luliu.me/. Confirm:
- Avatar circle + one-line poem hero.
- Posts archive page grouped by year.
- /tags/ index renders cloud (was 404 before Plan E).
- Theme toggle (☀/☾) works on live site, persists.

- [ ] **Step 2: Pandoc fix (§2) — content check**

Open https://luliu.me/posts/dao-tui-de-li-shi-mou-mis-xiang-mu-shou-ji-1-qie-wu-hua-rou/. Confirm sentences flow continuously, no mid-paragraph English/numeric splits.

- [ ] **Step 3: Node bump (§3) — CI check**

```bash
gh run list --workflow=deploy.yml --limit 1
```

Get the run ID. Then:

```bash
gh run view <RUN_ID> --log 2>&1 | grep -ic "deprecat"
```

Expected: `0`.

- [ ] **Step 4: Test suite still green**

```bash
pnpm vitest run 2>&1 | tail -5
```

Expected: all green (40+ tests).

- [ ] **Step 5: Plan E sign-off**

Update memory `cnblogs_pandoc_paragraph_breaks.md` to note resolution, OR remove the file if no longer relevant. Add a note in the user's scratchpad:

```
Plan E complete: 2026-05-05.
- Theme polished and live (avatar hero, year archive, tags index, theme toggle).
- 166 cnblogs posts re-flowed via fix-pandoc-paragraphs.
- GH Actions on Node 24 actions runtime.
Plan F+ deferred: search, comments, view counts, cover images, post nav, per-tag RSS.
```
