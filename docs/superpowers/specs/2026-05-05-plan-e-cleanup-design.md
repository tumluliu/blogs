# Plan E — Cleanup Pass: Theme Polish, /tags/ Index, Pandoc Fix, Node 24

**Status:** Approved 2026-05-05
**Scope:** Cleanup-only. Make the existing site look and read right. New features (search, comments, analytics, cover images, post nav, per-tag RSS) are deferred to Plan F+.

---

## Goal

Three concerns the site has after Plans A–D + the post-cutover patches:

1. The theme rendered the right *content* but the layout was visibly raw — typography too uniform, hero clumsy (monospace `<pre>` poem), no tag index page, header brand was the domain string, nav lacked light/dark control.
2. 166 cnblogs imports have sentences broken mid-flow around English/numeric runs (pandoc artifact from MS-Word-pasted source HTML). User flagged this as a hard "MUST resolve" item during Plan D verification.
3. GitHub Actions emits a deprecation warning on every deploy because `actions/checkout@v4` etc. still run on the deprecated Node 20 actions runtime. Will hard-break on 2026-09-16.

Plan E is the focused cleanup that closes those three.

## Architecture

Three independent workstreams in a single plan because they all touch existing code without adding new infra:

- **§1 Theme polish** — CSS pass + Astro template tweaks. Pure presentation. Already iterated in `plan-e-theme-polish` branch with live `pnpm dev` review.
- **§2 Pandoc fix** — one-shot Node script (`scripts/fix-pandoc-paragraphs.ts`) that post-processes the 166 cnblogs md files in place, idempotent, dry-run by default. No runtime dependency.
- **§3 Node 24 bump** — `.github/workflows/deploy.yml` action-version bumps + smoke deploy.

Each section is independently shippable but bundled here because they collectively close the "site is rough around the edges" gap.

## Tech stack

- Astro 6.2 / Content Layer API (already in place)
- TypeScript + tsx for the pandoc fix script
- Plain CSS (no Tailwind) — see §1
- Vitest for the pandoc fix script's heuristic tests
- GitHub Actions; bumping pinned `@vN` action references

---

## §1 — Theme polish

### State entering Plan E
- 222 cnblogs posts + 1 original post live
- Astro theme: 700px max width, system serif, light/dark via prefers-color-scheme, minimal header `luliu.me | Posts Thoughts About RSS`, basic post listing, tag detail pages but no tag index.
- Plan D Task 5 user feedback: "the theme is pretty simple. Not bad, but a bit raw."

### Target
- Polished minimal aesthetic (recommendation A from brainstorming). Inspirations: stephango.com, craigmod.com, plus structural cues from astro-scholar (typography hierarchy, generous whitespace). Not a copy of either.
- Personal blog tone, not academic. Author byline + avatar, not Publications/Presentations.

### Concrete changes (already in `plan-e-theme-polish` branch)

**`src/styles/global.css`** — full rewrite:
- Color palette: paper-white `--bg: #fdfcf9` light, warm dark `--bg: #161514`. Terra-cotta accent `--accent: #b25c2c` light / `#d68b54` dark. Link `--link: #1a4789` light / `#8ab4f8` dark. Soft tone `--soft: #999999` light / `#6b6864` dark for de-emphasized text.
- Typography: serif throughout (`Source Han Serif SC`, `Noto Serif CJK SC`, `Songti SC`, Georgia fallback). Body 18px / line-height 1.75 / letter-spacing 0.01em. Headings serif, hierarchical sizes 1.85 / 1.4 / 1.15 rem. Letter-spacing 0.02em on headings.
- Vertical rhythm scale: `--space-1` through `--space-5` (0.5 / 1 / 1.5 / 2.5 / 4 rem).
- Link styling: 1px underline-thickness, 3px underline-offset, decoration-color = `--rule` by default → `--link` on hover.
- Selection color = accent.
- `::selection`, `text-rendering: optimizeLegibility`, font-smoothing.
- Manual theme override via `:root[data-theme="dark|light"]` overrides `prefers-color-scheme`.

**`src/components/Header.astro`** — title-driven brand:
- Brand link is the title `主题没有,内容瞎写`, max-width 60% on desktop, full-width row on mobile (<600px).
- Nav lowercased: `posts`, `thoughts`, `tags`, `about`, `rss`. Active route gets accent underline.
- New theme toggle button at right of nav: ☀ for light mode, ☾ for dark. Click cycles auto → dark → light → auto. Persists to `localStorage` key `theme`. Inline script in `BaseLayout.astro` reads localStorage *before* CSS to avoid flash of unstyled mode.

**`src/components/Footer.astro`** — byline:
- `© 2005–YYYY 刘露 · 合金枪头 · built with Astro · rss`.
- 2005 is when the cnblogs blog began (oldest imported post).

**`src/pages/index.astro`** — hero refinement:
- Drop duplicate title h1 (already shown via header brand).
- Drop tagline `少刷微信多读书` (still in `<meta name="description">`).
- Avatar (`/images/avatar.png`, copied from VM backup `~/vm-backup-2026-05-05/hexo/source/images/avatar.png`) — circular, 9rem, centered, `--rule` border.
- Poem on a single horizontal line, muted color, letter-spacing 0.18em, line-height 1.9.
- Two `Recent posts` / `Recent thoughts` sections with `→ All posts` / `→ All thoughts` section heads.

**`src/pages/posts/index.astro`** — yearly archive:
- Group posts by `getUTCFullYear()` desc.
- Each year gets a monospace heading (`--mono`, 0.9rem, soft color).
- Date column shows `MM-DD` only (year already in heading).
- Post-list as a 5.5em date column + title grid for vertical alignment.

**`src/pages/tags/index.astro`** — NEW:
- Tag cloud component. Each tag is a styled chip showing tag + post count. Sorted by count desc, alpha tiebreaker.
- Hover: accent border + accent color.

### Validation
- `pnpm build` produces 248 pages (was 241): +5 new tag pages from earlier post additions, +1 tag index, +1 new original post about spatial memory.
- User-confirmed in `pnpm dev` (port 4321) iteration: hero "much better" after avatar + single-line poem.
- Light, dark, and auto modes all rendered without FOUC.

---

## §2 — Pandoc paragraph-break fix

### State
- 166 cnblogs md files imported via pandoc HTML→GFM conversion.
- Word-pasted source HTML had every text fragment wrapped in `<span style="FONT-...; mso-...">`. Earlier patch (commit `ab258e5`) stripped the `<span>` tags from 7 worst-affected posts, but the underlying pandoc paragraph breaks remained.
- Concrete failure case: `…抽调到北京支援一个MIS\n\n项目。\n\n`. The `MIS` and `项目。` belong to one sentence but render as three paragraphs.

### Target
- Sentences flow continuously across English/numeric runs. Paragraphs only break where the original Word `<p>` boundaries genuinely intended.
- Idempotent fix; can be re-run without further damage.
- Conservative — better to under-merge than to swallow legitimate short paragraphs.

### Algorithm

`scripts/fix-pandoc-paragraphs.ts` — TypeScript run via tsx. CLI:

```
pnpm tsx scripts/fix-pandoc-paragraphs.ts            # dry-run, prints diff stats
pnpm tsx scripts/fix-pandoc-paragraphs.ts --apply    # writes changes in place
pnpm tsx scripts/fix-pandoc-paragraphs.ts --apply --slug=foo  # single post
```

Pipeline per file (only files with `source: cnblogs` frontmatter):

**Step 1 — Strip trailing `\` line-break markers.**
- Pandoc emits `\` at line ends to preserve `<br>` semantics from the original HTML. Inside prose paragraphs these are noise.
- Replace `\\\s*$` (regex, multiline) → empty.
- Skip inside fenced code blocks (preserve original).

**Step 2 — Block-aware paragraph split.**
- Walk the file body line by line. Recognize block boundaries:
  - Frontmatter (between two `---` lines) — preserved verbatim.
  - Fenced code (between matching ` ``` `) — preserved verbatim.
  - Lines starting with `#` (heading), `>` (blockquote), `-`/`*`/`+`/`<digit>.` (list), `|` (table), `<` (HTML block), `![` standalone (image-only paragraph), `---`/`***`/`___` (HR) — each is its own block boundary.
  - Otherwise group consecutive non-empty lines into a paragraph; blank line(s) end a paragraph.
- Output a sequence of typed blocks: `prose`, `code`, `heading`, `list`, `quote`, `image`, `hr`, `html`, `frontmatter`.

**Step 3 — Merge adjacent prose blocks where sentence is mid-flow.**
- For consecutive blocks A, B both of type `prose`:
  - Strip trailing whitespace from A's last line; let `endChar` = last visible character.
  - If `endChar` ∉ `{。, ., ！, !, ？, ?, …, ;, ；, :, ：, 」, ", ')'}` then A's sentence is mid-flow.
  - And if B's first non-whitespace char is NOT a markdown structural prefix (handled by block split, but defensive): merge.
  - Merge: concatenate A's text + B's text with NO separator (no newline, no space — CJK doesn't need it; for ASCII context a space could be inserted if `endChar` is `[A-Za-z0-9]` and B starts with `[A-Za-z]`).
- Repeat: after merging A+B, re-check the merged block against the next; chain-merge until terminator hit or non-prose block reached.

**Step 4 — Re-emit.**
- Walk the merged block sequence and rejoin with `\n\n` between blocks. Preserve original frontmatter, code, heading, list, quote, image, hr verbatim.

### Edge cases

| Case | Handling |
|---|---|
| Paragraph ends with `」` or `"` | Treated as terminator (closing quotes typically end sentences). |
| Paragraph ends with `,` or `，` | Terminator NOT in skip set → continues merging. Risk of over-merge if intentional comma-paragraph. Acceptable for cnblogs imports; not common in practice. |
| Paragraph ends with `:` or `：` | Treated as terminator (often introduces next block: list, blockquote). |
| Empty paragraph between two prose paras (just whitespace) | Already collapsed by paragraph split. |
| Image-only paragraph (`![alt](src)` alone) | Block type `image`, not merged. |
| Inline image inside prose | Stays as part of paragraph. |
| File with no `source: cnblogs` frontmatter | Skipped entirely. |

### Output
- Dry-run prints per-file: `<slug>: <N> merges, <M> backslash strips`.
- Aggregate summary at end: `<total files> processed, <X> changed, <Y> merges, <Z> strips`.
- `--apply` writes files in place. `git diff` shows changes; user reviews.
- Expected scope: at minimum the dao-tui post user flagged. The pandoc break artifact is widespread across the 166 imports (any post pasted from Word with `<span lang="EN-US">` runs); merge count is unknown until first dry-run reports it.

### Tests

`scripts/lib/fix-pandoc-paragraphs.test.ts` (vitest) covers:

1. Strips trailing `\` from prose lines, leaves code-block content alone.
2. Merges three-block `CJK + ASCII + CJK` pattern with no separator.
3. Inserts space when merging `English + English` at word boundary.
4. Does NOT merge across heading.
5. Does NOT merge across list/blockquote.
6. Does NOT merge across image-only paragraph.
7. Idempotent: running twice produces identical output as once.
8. Frontmatter preserved verbatim.
9. Fenced code preserved verbatim (including blank lines inside).

### Risks & mitigations

- **Over-merge of legitimately short paragraphs.** Mitigation: conservative terminator set; user reviews `git diff` before commit. Apply per-file or per-batch if large diff feels wrong.
- **Loss of meaningful `\` hard breaks.** Mitigation: real `\<br>` cases are rare in cnblogs prose; if found, can be restored manually or we can refine the strip to skip when paragraph already ends with structural content. Acceptable risk.
- **Heuristic surprises future cnblogs authors.** Plan E is one-shot for the 166 imported posts. Future cnblogs imports (Plan F+ if any) won't run this script; they'll be handled at conversion time.

---

## §3 — Node 24 bump (CI)

### Problem
GitHub Actions emits the following warning on every deploy run since 2026-05-05:

> Node.js 20 actions are deprecated. The following actions are running on Node.js 20 and may not work as expected: actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026. Node.js 20 will be removed from the runner on September 16th, 2026.

This is about the actions' *runtime*, not the build job's Node version (which is `22` via `setup-node`).

### Fix
Bump pinned action versions in `.github/workflows/deploy.yml`:

| From | To | Notes |
|---|---|---|
| `actions/checkout@v4` | `actions/checkout@v5` | First v5 runs on Node 24. |
| `actions/setup-node@v4` | `actions/setup-node@v5` | First v5 runs on Node 24. |
| `pnpm/action-setup@v4` | `pnpm/action-setup@v5` | If v5 not available at edit time, leave v4 + add `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` at workflow level (per GitHub's escape hatch). |

Keep `node-version: 22` for the build job — independent concern, and Astro 6 / pnpm 9 work fine on Node 22.

### Validation
- Push the workflow change to master → trigger a deploy.
- Verify run completes without the deprecation annotation in the run summary.
- Verify `pnpm build` step still produces 248 pages.
- If v5 of any action breaks something, revert to v4 + env var fallback.

---

## Out of scope (deferred to Plan F+)

Each is its own plan because each needs independent design decisions:

- **Search** — Pagefind (static, builds from dist) vs server-side. Pagefind is the obvious choice but indexing 223 CJK posts deserves a tuning pass.
- **Comments** — Giscus vs Cusdis vs none. Privacy + moderation tradeoff.
- **View counts** — GoatCounter (preferred — privacy-respecting, self-hostable) vs Plausible vs nothing.
- **Cover images** — schema already has `cover: image()` field; need actual cover-image content + per-post layout.
- **Post navigation** — prev/next links at end of post, by date.
- **Per-tag RSS** — each tag gets `<host>/tags/<tag>/rss.xml`. Cheap to implement but needs a `getStaticPaths` for tag detail pages already on file.

These are all additive features. The site is cohesive and shippable without them. Plan E ends with a polished, correctly-rendered, modern-CI personal blog.

---

## Acceptance

Plan E is done when:

1. `plan-e-theme-polish` branch's visual changes (§1) are merged to master and deployed; user manually verifies on luliu.me that hero, posts archive, tags index, post detail render as designed in light + dark + auto modes.
2. `scripts/fix-pandoc-paragraphs.ts` exists with passing tests; applied to all 166 cnblogs posts; user-flagged dao-tui post reads cleanly; `git diff` reviewed and committed.
3. CI deploy completes with no Node 20 deprecation warning.
4. All four section deliverables committed and live on luliu.me.
