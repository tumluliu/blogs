# Obsidian Workflow After Astro Migration

## One-time Obsidian Settings

Open `Settings` (gear icon, bottom-left) and configure:

### Files & Links

| Setting | Value | Why |
|---|---|---|
| Default location for new notes | `In the folder specified below` → `src/content/blog` | "New note" lands in right folder automatically |
| Default location for new attachments | `In subfolder under current folder` | Pasted images go to per-post subfolder, matches Astro convention |
| Subfolder name | `{{filename}}` (or leave default — Obsidian uses note name) | Folder name = post slug |
| Detect all file extensions | `On` | `.ts`, `.astro`, `.mjs` show as attachments, not editable noise |
| Use [[Wikilinks]] | `Off` (recommended) | Keep links as standard markdown so Astro renders them; wikilinks are Obsidian-only |

### Editor

| Setting | Value | Why |
|---|---|---|
| Strict line breaks | `On` | Matches markdown spec, predictable rendering on the site |

### Core Plugins

- Enable **Templates** (built-in) — for `Templater` see below.

### Recommended Community Plugins

| Plugin | Purpose |
|---|---|
| **Templater** | Auto-fills frontmatter (`title`, `date`, `slug`) on new note. Replaces `scripts/new-post.ts` for Obsidian-only authoring. |
| **Obsidian Git** | One-click commit & push from inside Obsidian. Replaces terminal git. |
| **Paste image rename** (optional) | Renames pasted image from `Pasted image 20260101120000.png` to `cover.png` etc. |

## Templater Frontmatter Template

Save to `src/content/blog/_templates/blog-post.md` (or wherever Templater is configured):

```markdown
---
title: <% tp.file.title %>
slug: <% tp.file.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') %>
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
updated: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZ") %>
tags: []
draft: true
---

```

`draft: true` blocks publishing until you flip it to `false` — safety net for half-written posts.

## Daily Authoring Flow

1. **`Cmd+N`** — new note. Lands in `src/content/blog/`.
2. Type title. Templater auto-fills frontmatter.
3. Write body in markdown.
4. **`Cmd+V`** an image — auto-saved to `src/content/blog/<slug>/`.
5. Set `draft: false` when ready.
6. Commit & push:
   - Via Obsidian Git plugin: `Cmd+P` → `Git: Commit and push`.
   - Or terminal: `git add -A && git commit -m "new post: <title>" && git push`.
7. GitHub Actions builds and rsyncs to VM. Live in ~1 min.

## File Explorer Tidiness

Astro project files clutter the repo root. Collapse them in Obsidian's file explorer (Obsidian remembers):

- `node_modules/`
- `dist/`
- `.github/`
- `infra/`
- `scripts/`

Real writing happens under `src/content/blog/` and `src/content/thoughts/` — keep those expanded.

## Microblog ("Thoughts") Flow

1. **`Cmd+N`** in `src/content/thoughts/` (set as alternate folder, or use Quick Switcher).
2. Filename: ISO timestamp (Templater handles): `2026-05-05-1023.md`.
3. No title required — just date + body.
4. Push.

Optional: bind a hotkey to "New thought" via Templater's "Insert template" command pointing to a thoughts template.

## Migration-day Reminders

When migration script renames `大数据的陷阱.md` → `da-shu-ju-de-xian-jing.md`:

- Obsidian re-indexes — no manual action needed.
- Internal `[[wikilinks]]` (if any exist) need rewriting; the rename script should report them.
- Original Chinese title is preserved in frontmatter `title:` field — display on site is unchanged.
