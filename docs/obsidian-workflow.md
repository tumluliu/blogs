# Authoring workflow

This site is built with Astro, but the content layer is intentionally
loose so you can write posts as **plain markdown files** in any editor —
Obsidian, vim, GitHub web, the `/q-sort/` PWA — without learning Astro.

## Minimum viable post

Drop a file at `src/content/posts/<slug>.md` containing nothing but markdown:

```markdown
# 我的新文章

正文…
```

That's it. The build derives the missing pieces:

| Field | Source if frontmatter omits it |
|------|--------------------------------|
| `title` | First `# H1` in the body, else the filename |
| `slug` | Filename (without `.md`) |
| `date` | Filename like `2026-05-08…` if present, else file mtime |
| `tags` | Empty list |
| `draft` | `false` |
| `source` | `'original'` |

## When to add frontmatter

Only when you want a value other than the derived default. Examples:

```markdown
---
tags: [react, performance]
date: "2026-05-05T00:00:00.000Z"
draft: true
---

# Title

Body…
```

Anything you put in YAML wins over the derived defaults. Anything you
omit gets filled in.

## Images

Drop image files anywhere under `src/content/` and reference them
**relatively** from your markdown:

```markdown
![Caption](../diagrams/article/03-foo.png)
```

Astro's image pipeline picks them up, optimises (PNG → webp, ~10×
smaller), and serves hashed asset URLs. Folder layout is up to you —
typical patterns:

- `src/content/posts/foo/cover.png` (per-post folder)
- `src/content/diagrams/<topic>/01-name.png` (shared diagrams)

Avoid putting new content images under `public/`. Files there bypass
the optimiser and ship at full size.

## Daily flow

### Desktop, Obsidian or any editor

1. Edit a `.md` under `src/content/posts/` or `src/content/thoughts/`.
2. `git add -A && git commit -m "..." && git push`.
3. The pre-push hook runs `pnpm build` (~1.5s). If the build breaks
   (missing image, schema drift, TypeScript error in a page), the push
   is rejected with the failing log. Bypass with `git push --no-verify`
   only when you are sure.
4. CI deploys → live on https://luliu.me/ in ~2 min.

### Mobile, Obsidian Android

1. Create or edit a `.md` in the right folder via Obsidian. Templater
   stamps a thought template if you use the `Templater: Create new
   note from template` command (see `templates/thought.md`).
2. obsidian-git auto-commits + pushes. **No pre-push hook runs on
   Android** — isomorphic-git can't run shell hooks. Your safety net
   is CI: a broken push fails the deploy workflow, you'll see it red
   on GitHub. Fix from desktop afterwards.

### Mobile, fast thought capture

Use the PWA at https://luliu.me/q-sort/. Tap home-screen icon, type,
Publish. Goes through the GitHub Contents API and triggers the same
deploy.

## Recommended Obsidian settings

| Setting | Value | Why |
|---------|-------|-----|
| Files & links → Default location for new notes | `In the folder specified below` → `src/content/posts` | New note lands in the right place |
| Files & links → Default location for new attachments | `In subfolder under current folder` | Pastes images alongside the post |
| Editor → Strict line breaks | `On` | Matches CommonMark, predictable rendering |
| Files & links → Use [[Wikilinks]] | `Off` | Keep links portable across Astro / GitHub web / cnblogs export |

Excluded files (Settings → Files & links → Excluded files), to keep
search/graph/quick-switcher focused on prose:

```
node_modules
dist
.astro
scripts
infra
public
.github
.vscode
docs
src/components
src/layouts
src/pages
src/styles
src/data
```

## Recommended community plugins

| Plugin | Purpose |
|--------|---------|
| **Templater** | Lets `templates/thought.md` self-locate to `src/content/thoughts/` and self-name as `YYYY-MM-DD-HHmm.md`. |
| **Obsidian Git** | Commit + push from inside Obsidian (desktop or Android). |

## Pre-push hook

Installed automatically on `pnpm install` via the `prepare` script,
which sets `git config core.hooksPath .githooks`.

If `git config --get core.hooksPath` does not return `.githooks`, run
`pnpm install` once. The hook is `.githooks/pre-push` — read it, edit
it, or skip it via `git push --no-verify`.

## Cheatsheet

- "I want to write a post." → create a `.md` file with a `# H1`. Nothing else needed.
- "I want a specific date." → add `date:` in frontmatter.
- "I want to publish later." → add `draft: true`.
- "I want an image." → put it under `src/content/`, reference relatively.
- "I broke the build." → pre-push hook tells you. Fix and re-push.
- "Mobile push is broken." → check CI; fix from desktop.
