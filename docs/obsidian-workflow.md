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

## Writing long-form from a phone (or a laptop)

`/q-write/` is a PWA for long-form posts — the sibling of `/q-sort/`
for quick thoughts. Install it to the home screen (or just keep the
tab open on a laptop; the layout is a single column capped at the
blog's own reading measure — `--max-width: 720px` — from 600px of
viewport width up, so it is comfortable on a desktop browser too, not
just a phone). Paste a fine-grained PAT into settings once — it shares
`localStorage` keys with `/q-sort/` (`qsort.pat`, `qsort.repo`), so a
device configured for one tool is configured for both.

### What it does

- **Drafts**: autosave to IndexedDB 800ms after you stop typing, with
  no network involved. "存到仓库" checkpoints the current draft to
  `src/content/posts/<slug>.md` with `draft: true` (commit message
  `draft: <slug> via q-write`) — that's the cross-device sync
  mechanism: save on the phone, open the same repo entry on the
  laptop.
- **Publishing**: "发布" writes the same file with `draft: false`
  (commit message `post: <slug> via q-write`). Draft posts are
  already excluded from every listing page and the RSS feed, so a
  repo checkpoint never leaks to the live site before you publish.
- **Editing published posts**: the list screen's "仓库文章" section
  searches all post slugs (one `listDir` call); picking one fetches
  its content and sha and opens it in the same editor. Saving sets
  `updated` to now and leaves every other frontmatter field alone.
- **Images**: pick from the camera or the filesystem (or paste /
  drag-drop on desktop). Each photo is downscaled to a 1600px long
  edge, encoded to webp, and named by the first 8 hex characters of
  a SHA-256 hash of the *compressed* bytes — so inserting the same
  photo a second time resolves to the same file instead of uploading
  a duplicate (a `getFile` probe runs first; the `PUT` only happens
  on a 404). The path is `public/media/YYYY/MM/<hash8>.webp`,
  referenced in the markdown as `/media/YYYY/MM/<hash8>.webp` —
  already under `public/` and site-absolute, matching this repo's
  own asset convention rather than needing any cleanup afterward.
- **Offline**: the app shell (`/q-write/`, the manifest, both icons)
  is cached by its own service worker, `public/sw-q-write.js`
  (cache `qwrite-v1`, scope `/q-write/`), completely separate from
  `/q-sort/`'s `public/sw.js`. Drafts still load and autosave with no
  connection; saving to the repo, uploading images, and publishing
  need connectivity and fail with a clear "离线" message without
  losing anything typed.

### Keyboard shortcuts

Available once the body textarea (or, for Save, anywhere in the
editor) has focus:

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+S | Save to repo (same as "存到仓库") |
| Cmd/Ctrl+B | Bold the selection |
| Cmd/Ctrl+K | Insert a link |
| Cmd/Ctrl+Shift+P | Toggle the 写作/预览 tab |

Publish deliberately has **no** shortcut — it deploys the live site,
so it stays a deliberate tap on "发布", never a stray keystroke.

### Setup

1. Open `/q-write/` (or `/q-sort/` — either sets the same keys), tap
   ⚙, paste a fine-grained PAT scoped to `Contents: Write` on
   `tumluliu/blogs` with an expiry, confirm the repo (defaults to
   `tumluliu/blogs`), save.
2. Install to the home screen if writing from a phone; on a laptop a
   pinned browser tab works the same way.
3. Both `/q-write/` and `/q-sort/` are excluded from `robots.txt` and
   carry `noindex,nofollow` — the route is public, but the PAT scope
   is the actual protection, not obscurity.

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

### Mobile, long-form writing

Use the PWA at https://luliu.me/q-write/ — see "Writing long-form
from a phone (or a laptop)" above. Same PAT as q-sort, same GitHub
Contents API, same deploy trigger; the difference is drafts,
frontmatter, and an image pipeline instead of a single publish tap.

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

## Counter service (engagement features)

Posts show word count, reading time, view count, Like and Share at
the bottom. Engagement data lives in a tiny Go service on the same
Hetzner VM at `localhost:8787`, reverse-proxied by Caddy under
`/api/*`. State is one SQLite file (`/var/lib/counter/counter.db`).

Day-to-day: nothing to do. The counter is deployed by CI on push to
`master` when anything under `infra/services/counter/**` or
`infra/Caddyfile` changes.

One-time VM bootstrap (already in `infra/vm-bootstrap.sh`): creates
the `counter` user, `/var/lib/counter`, `/opt/counter`, a placeholder
`counter.service` unit, a nightly `counter-backup.timer`, and sudoers
for `deploy` to install the binary, reload Caddy, and restart counter.

Backups: nightly GitHub Action pulls `/var/lib/counter/counter.db.bak`
(taken by a systemd timer that runs `sqlite3 ".backup"`) into a
workflow artifact with 90-day retention. Restore = scp `.bak` back
and `systemctl restart counter`.

If the counter is down, posts still render fine — the engagement chrome
shows `—` for both counters and the Like / Share buttons stay
non-functional (console.warn only, no on-page error).

## Cheatsheet

- "I want to write a post." → create a `.md` file with a `# H1`. Nothing else needed.
- "I want a specific date." → add `date:` in frontmatter.
- "I want to publish later." → add `draft: true`.
- "I want an image." → put it under `src/content/`, reference relatively.
- "I broke the build." → pre-push hook tells you. Fix and re-push.
- "Mobile push is broken." → check CI; fix from desktop.
- "I want to write a long post from my phone." → https://luliu.me/q-write/, install to home screen, same PAT as q-sort.
