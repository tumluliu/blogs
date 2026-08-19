# q-write — Long-Form Post Editor PWA — Design Spec

**Date**: 2026-08-19
**Status**: Approved (v1 scope locked)
**Author**: Lu Liu (with Claude)
**Related**: `docs/superpowers/specs/2026-05-07-quick-thought-pwa-design.md` (q-sort)

## Problem

Publishing a long-form post today means Obsidian on a desktop: get the
filename slug right, get the frontmatter right, drop images under
`public/` by hand, write site-absolute paths, then wait for
`obsidian-git` to commit and push. Adding a paragraph from a phone is
effectively impossible, and inserting a photo taken on that phone is
worse.

Meanwhile `/q-sort/` proved the opposite experience: type, tap, the
thought is in the repo and live two minutes later. That ergonomics gap
is the whole motivation — long-form should feel the same.

## Goal

A second page on the same Astro site, `/q-write/`, installable as its
own PWA, that can:

1. Write and edit long-form markdown posts on phone or desktop.
2. Insert images from the camera or the local filesystem in one tap,
   with compression and upload handled automatically.
3. Keep drafts across days and across devices.
4. Edit posts that are already published.

Its pure logic must be reusable so that a later version can fold both
tools into one app with a mode switch (thought / post).

## Non-goals (v1)

- Merging into `/q-sort/` as a mode toggle (later; the shared-lib split
  is what makes it cheap).
- Automatic cross-device draft sync (manual "save to repo" is the sync
  mechanism).
- Orphan-media cleanup script for images belonging to abandoned drafts.
- Image cropping / rotation / annotation UI.
- Three-way merge on write conflicts (v1 offers overwrite or save-as).
- Tag autocomplete from existing posts.
- A delete-post action in the UI. (`DELETE` is still called as the
  second half of a slug rename — see Publish semantics.)

## Decisions

| Question | Decision |
|----------|----------|
| Draft lifecycle | Local autosaved drafts **and** editing already-published posts |
| Image storage | Upload on pick, to a slug-independent media library |
| Draft storage | IndexedDB autosave + explicit "save to repo" checkpoint |
| Editor | Plain `textarea` + toolbar + preview tab (no CodeMirror, no WYSIWYG) |
| Placement | New page `/q-write/`, shared libs with q-sort |
| Slug | Browser-side pinyin, auto-generated from title, hand-editable |
| Opening old posts | Directory listing + client-side search box |
| UI layer | Vanilla TS, no framework |

## Architecture

### Data flow

```
新建 ────写────────> IndexedDB (debounce 800ms autosave)
插图 ──> canvas 压缩 webp ──PUT──> public/media/YYYY/MM/<hash8>.webp
                            └────> 正文插入 ![](/media/YYYY/MM/<hash8>.webp)
存到仓库 ──PUT──> src/content/posts/<slug>.md   (draft: true)  → 记 sha
发布     ──PUT──> src/content/posts/<slug>.md   (draft: false) → 记 sha
                       │
                       ▼
             GitHub Actions deploy.yml → https://luliu.me/ (~2 min)

改旧文 ──listDir──> 搜索选中 ──GET(content+sha)──> 编辑 ──PUT(sha)──> 更新
```

### Files

| File | Purpose |
|------|---------|
| `src/lib/gh/client.ts` | GitHub Contents API: `getFile`, `putFile`, `deleteFile`, `listDir`, `putBinary` |
| `src/lib/gh/config.ts` | PAT + repo in `localStorage` (existing `qsort.*` keys) |
| `src/lib/q-write/slug.ts` | Title → slug via `pinyin-pro`, mirroring `scripts/lib/slugify.ts` |
| `src/lib/q-write/frontmatter.ts` | Parse / merge / serialize frontmatter with `js-yaml` |
| `src/lib/q-write/image.ts` | Resize + encode + content-hash naming |
| `src/lib/q-write/paths.ts` | Media and post path construction |
| `src/lib/q-write/drafts.ts` | IndexedDB CRUD for drafts |
| `src/pages/q-write/index.astro` | Page + DOM controllers (list / editor / settings) |
| `public/q-write.webmanifest` | PWA manifest, `scope`/`start_url` = `/q-write/` |
| `public/sw-q-write.js` | Service worker, cache `qwrite-v1` |
| `public/icons/q-write-192.png`, `-512.png` | PWA icons |
| `public/robots.txt` | Add `Disallow: /q-write/` |

### Refactor of existing code

`src/lib/q-sort/api.ts` and `src/lib/q-sort/storage.ts` move into
`src/lib/gh/`, generalised from "PUT a thought" to "PUT any path".
`src/pages/q-sort/index.astro` switches to the shared client. Behaviour
must not change; the existing `src/lib/q-sort/api.test.ts` and
`builders.test.ts` are the regression net and move with the code.

`src/lib/q-sort/builders.ts` keeps the thought-specific builders;
`utf8Base64` moves to `src/lib/gh/` since both tools need it.

### New dependencies

| Package | Why | Cost |
|---------|-----|------|
| `marked` | Render the preview tab | ~10KB gz |
| `pinyin-pro` | Browser-side Chinese → pinyin slug | ~40KB gz |

`js-yaml` is already a dependency and is browser-safe; no new package
for frontmatter.

### Draft record (IndexedDB `q-write` / store `drafts`)

```ts
interface Draft {
  id: string;              // crypto.randomUUID()
  title: string;
  slug: string;
  slugManual: boolean;     // true once hand-edited; stops auto-regeneration
  tags: string[];
  body: string;            // markdown, no frontmatter
  frontmatterExtra: Record<string, unknown>;  // unknown keys preserved from remote
  hadFrontmatter: boolean; // false for legacy posts with none
  remotePath?: string;     // e.g. src/content/posts/foo.md
  remoteSha?: string;
  state: 'local' | 'synced' | 'published';
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

## UI

Three screens inside a single page; `display` toggling, no router.

### 1. List screen (launch screen)

- Top bar: `q-write` wordmark, status line, ⚙ settings.
- `＋ 新文章` primary button.
- **草稿** section: drafts sorted by `updatedAt` desc. Each row shows
  title, a state dot (local / synced / published), relative time, and
  word count.
- **仓库文章** section: search box filtering all post slugs fetched in
  one `listDir` call (229 files today; the API returns up to 1000).
  Selecting a row fetches the file and opens the editor.

### 2. Editor screen

- Top bar: ← back, doc state, autosave status, ⋯ (delete draft / copy markdown).
- Title input (serif, article-sized).
- `SLUG` row: auto-generated, truncated with ellipsis, `改` opens it for
  editing. Editing sets `slugManual` and stops regeneration.
- `TAGS` row: chips plus an add control.
- Tabs: 写作 / 预览, with a live word count on the right.
- 写作 pane: full-height `textarea` in the blog's serif at the blog's
  line height, so the writing surface matches the published article.
- 预览 pane: `marked` output styled with the blog's typography.
- Upload strip (only while uploads are pending or failed): per-image
  name, original → compressed size, progress, retry on failure.
- Toolbar: 插图 | H2 | B | 链接 | 引用 | 代码 | 列表.
- Actions: `存到仓库` (ghost) and `发布` (solid).

### 3. Settings dialog

PAT (password field), repo, save / clear. Shares `localStorage` keys
with q-sort, so a device configured for one is configured for both.

### Visual design

Follows the blog's own palette rather than q-sort's slate/blue: paper
`#fdfcf9` / ink `#1a1a1a` in light, `#161514` / `#e6e3dc` in dark,
terracotta accent `#b25c2c` (`#d68b54` dark). Source Han Serif for all
content surfaces, system sans for UI labels, mono reserved for machine
data (slugs, timestamps, byte sizes). Hairline rules instead of cards,
a low-opacity paper grain overlay, staggered row entrance, sliding tab
underline. Theme follows the same `data-theme` attribute + pre-paint
inline script as q-sort.

An approved static mock of all three screens exists at
`src/pages/q-write/index.astro` and is replaced wholesale by the
implementation.

## Image pipeline

1. `<input type="file" accept="image/*" multiple>`. No `capture`
   attribute — on Android that would force the camera and remove the
   gallery/files choice.
2. `createImageBitmap(file, { imageOrientation: 'from-image' })` so EXIF
   rotation is applied and portrait photos are not sideways.
3. Downscale so the long edge is at most **1600px**; never upscale.
4. Encode via `OffscreenCanvas.convertToBlob({ type: 'image/webp',
   quality: 0.82 })`, falling back to `HTMLCanvasElement.toBlob` where
   `OffscreenCanvas` is missing, and to `image/jpeg` quality 0.85 where
   webp *encoding* is unsupported (detected by checking the returned
   blob's `type`, not by feature-sniffing).
5. Name = first 8 hex of SHA-256 over the **compressed** bytes, so the
   same image inserted twice resolves to the same file.
6. `getFile` probe first; only `putBinary` on 404. Identical images cost
   one read, not one write.
7. Path: `public/media/YYYY/MM/<hash8>.webp`, referenced in markdown as
   `/media/YYYY/MM/<hash8>.webp` — site-absolute, per the repo's asset
   convention.
8. While in flight, the cursor position gets `![](uploading:<id>)`;
   on success it is replaced in place with the real path, on failure
   with a retryable marker. The body text is never lost.
9. Uploads run sequentially to avoid GitHub write rate limits.
10. Preview keeps an in-memory `path → blobURL` map so freshly uploaded
    images render locally instead of 404ing before the site redeploys.
11. Paste and drag-drop on desktop enter the same pipeline.

A 4MB phone photo lands around 200–400KB, far below the Contents API
payload limit.

## Publish semantics

```
local ──存到仓库──> synced (draft: true) ──发布──> published (draft: false)
```

- `存到仓库`: PUT `src/content/posts/<slug>.md` with `draft: true`,
  commit message `draft: <slug> via q-write`. Store the returned
  `content.sha`.
- `发布`: same path, `draft: false`, commit message
  `post: <slug> via q-write`.
- Editing a published post: `GET` for content + sha, `PUT` with that
  sha, and set `updated` to now (the posts schema already has an
  optional `updated` field).
- Renaming the slug of a file that already exists remotely: PUT the new
  path first, then DELETE the old one. A failed delete warns but does
  not roll back — the content is already safe at the new path.
- New posts get `title`, `slug`, `date`, `tags`, `draft`, and
  `source: original`, matching `scripts/new-post.ts`. `date` is stamped
  when the file is **first created in the repo** (whichever of save or
  publish happens first) and never rewritten afterwards; later edits
  touch `updated` instead.
- A slug rename on a draft that has never been saved to the repo is a
  purely local rename — no remote calls.

Draft posts are already excluded from every listing (`index.astro`,
`posts/index.astro`, `posts/[...slug].astro`, `rss.xml.ts` all filter
`!data.draft`), so a repo checkpoint never leaks to the live site.

## Frontmatter handling

Parse the existing block with `js-yaml`, overwrite only
`title` / `slug` / `tags` / `draft` / `updated`, and dump. Unknown keys
(`source`, `sourceUrl`, `cover`, …) survive untouched. Key order after a
round-trip is js-yaml's, not the original's; that is accepted.

Legacy posts with **no** frontmatter (title derived from the first `#`
H1, date from filename or mtime) are not force-migrated:

- The title field shows that first H1.
- Editing the title rewrites that H1 line in the body.
- A frontmatter block is written only if the user actually sets tags or
  toggles draft — and then `title` is still left out, so the post never
  ends up with both a frontmatter title and an H1 saying something else.

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| No PAT | Publish/save disabled, status points at settings |
| 401 | `PAT 失效` + open settings |
| 403 / 404 on write | `仓库或权限不对` |
| 409 / 422 sha conflict | `远端已变` → choose 覆盖 (re-GET sha, re-PUT) or 另存为新 slug. No three-way merge. |
| New post whose slug already exists remotely | Blocked with `slug 已存在`; never silently overwrites |
| Network failure | `离线 · 已存本地`; the draft is intact, the button becomes retry |
| Image upload failure | Placeholder stays in the body, upload strip offers retry |
| Compressed image still > 5MB | Rejected with a message; no upload attempted |
| 5xx | `GitHub <code>，稍后重试` with retry |

## Security

- `<meta name="robots" content="noindex,nofollow">` on the page and
  `Disallow: /q-write/` in `public/robots.txt`.
- The route is public; obscurity is not the protection layer.
- Protection is the PAT scope: fine-grained, single repo
  `tumluliu/blogs`, `Contents: Write`, with an expiry.
- The PAT lives in `localStorage` per device, shared with q-sort.
- No server proxy; the page calls `api.github.com` directly.

## Service worker / offline

`public/sw-q-write.js`, cache `qwrite-v1`, registered with scope
`/q-write/`. Shell: `/q-write/`, `/q-write.webmanifest`, both icons.
Never intercepts `api.github.com`. q-sort's `public/sw.js` is left
completely untouched.

Offline: the app launches, drafts load and save locally. Saving to the
repo, uploading images, and publishing require connectivity and fail
with the offline message above.

## Testing

**Vitest units** (no DOM required):

- `slug.ts` — Chinese, mixed CJK/ASCII, apostrophes, over-length
  truncation at a word boundary; parity with `scripts/lib/slugify.ts`
  on a shared fixture list.
- `frontmatter.ts` — unknown-key preservation, legacy no-frontmatter
  posts, the H1-title rule, tags round-trip, `updated` insertion.
- `paths.ts` — media path from a date + hash, post path from a slug.
- `gh/client.ts` — mocked `fetch`: 201, 401, 409, network throw;
  correct headers, branch, and base64 body.
- CJK base64 encoding (moved test).
- `image.ts` — the pure half: target-dimension math (no upscale, long
  edge clamp), hash-to-filename, extension selection.

**Manual acceptance** (the canvas half cannot be unit-tested under
jsdom):

1. Android Chrome: install to home screen, launch fullscreen.
2. Take a photo from the picker, watch it compress and upload, see the
   real path replace the placeholder.
3. Publish; the post is live within ~2 minutes with the image visible.
4. Reopen a published post from the repo list, edit a paragraph,
   re-publish; `updated` appears and no other frontmatter key changed.
5. Start a draft on the phone, save to repo, continue on desktop.
6. Airplane mode: the app launches, drafts still edit, publish shows the
   offline error and loses nothing.

## Acceptance criteria

v1 is complete when:

1. `/q-write/` loads with the three screens and installs as its own PWA.
2. With no PAT, repo actions are disabled and the status says so.
3. A new post can be written, imaged, and published end to end from a
   phone, appearing on the live site.
4. A draft survives a browser restart and can be checkpointed to the
   repo and resumed on another device.
5. An already-published post can be opened from the repo list, edited,
   and re-published without losing any frontmatter field.
6. `pnpm test` passes, including the moved q-sort tests.
7. `pnpm check:content-paths` and `pnpm check:assets` pass on a build
   containing a post published by q-write.
8. `/q-sort/` behaves exactly as before the shared-lib refactor.

## Deferred to v2+

- Fold q-write and q-sort into one app with a mode switch.
- Orphan-media reporting script (`scripts/check-orphan-media.ts`).
- Conflict diff view instead of overwrite / save-as.
- Tag autocomplete sourced from existing posts.
- Offline write queue that flushes on reconnect.
