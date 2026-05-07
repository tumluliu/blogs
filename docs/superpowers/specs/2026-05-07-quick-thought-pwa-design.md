# Quick-Thought PWA — Design Spec

**Date**: 2026-05-07
**Status**: Approved (v1 scope locked)
**Author**: Lu Liu (with Claude)

## Problem

Capturing a new "thought" currently requires either:

1. Running `pnpm new-thought` on a desktop with the repo cloned, or
2. Authoring a markdown file in Obsidian (mobile or desktop) with the
   correct frontmatter and filename, then waiting for `obsidian-git`
   to commit + push.

Both flows are too slow for the "lightning capture" use case the user
wants on mobile (and is also useful from any browser).

## Goal

A lightweight web page on the existing Astro blog that lets the user
type a thought and publish it to the repo (which auto-deploys to the
live site) in a single tap.

The page must work as a Progressive Web App (PWA) so it can be installed
to the Android home screen, opens fullscreen with the textarea
auto-focused, and runs offline-shell (UI loads even without network;
submission requires network).

## Non-goals (v1)

- Tags input on the form.
- PIN-based encryption of the stored PAT.
- Offline submission queue (submissions require connectivity at send time).
- Editing or deleting existing thoughts.
- Creating long-form posts (different workflow, different schema).
- Image uploads or attachments.
- Multi-user / shared access.

## Architecture

### High-level data flow

```
Phone/desktop browser
  └─ /q-sort/ (Astro page, PWA-installed)
       │  user types text, taps Publish
       ▼
  GitHub Contents API (PUT)
       │  base64-encoded markdown,
       │  Authorization: Bearer <PAT>
       ▼
  Repo: src/content/thoughts/YYYY-MM-DD-HHmm.md (new file on master)
       │
       ▼
  GitHub Actions: .github/workflows/deploy.yml
       │  pnpm build → rsync to VM
       ▼
  https://luliu.me/  (new thought visible)
```

### Components

All net-new files live in this repo:

| File | Purpose |
|------|---------|
| `src/pages/q-sort/index.astro` | Page + inline `<script>` driving the UI. Single screen. |
| `public/manifest.webmanifest` | PWA manifest (name, icons, `display: standalone`, `start_url: /q-sort/`). |
| `public/sw.js` | Service worker; caches the page shell + manifest + icons for offline launch. |
| `public/icons/q-sort-192.png` | PWA icon, 192×192. |
| `public/icons/q-sort-512.png` | PWA icon, 512×512 (used for splash). |
| `public/robots.txt` | Patched to disallow `/q-sort/`. |

Astro-side glue:

- The page sets a `<link rel="manifest" href="/manifest.webmanifest">`
  and a `<meta name="robots" content="noindex,nofollow">`.
- The page registers `/sw.js` on load.

### UI

Single screen, vertical stack:

1. **Status line** (top, small): `idle` / `publishing…` / `published — deploying` / `error: <msg>` + retry button.
2. **Textarea**: full remaining height, autofocused on mount, `inputmode="text"`, `autocapitalize="sentences"`, `spellcheck="true"`.
3. **Publish button**: bottom, full width, disabled when textarea empty or while a request is in flight.
4. **Settings** (gear icon top-right): opens a modal with two text inputs (`PAT`, `repo` defaulted to `tumluliu/blogs`) and a Save button. Also has a "Clear" button to wipe the stored PAT from `localStorage`.

No CSS framework. Hand-roll ~50 lines of CSS scoped to the page.

### Submit flow

On Publish click:

1. Read textarea body. Trim trailing whitespace; reject if empty.
2. Compute `now = new Date()`.
3. Build filename: `YYYY-MM-DD-HHmm.md` from `now` in local timezone (matches existing `scripts/new-thought.ts` convention).
4. Build markdown:

   ```
   ---
   date: <ISO 8601 with timezone offset>
   tags: []
   ---
   <body>
   ```

5. base64-encode the UTF-8 markdown bytes (use `btoa(unescape(encodeURIComponent(s)))` or modern `TextEncoder` + chunked base64).
6. PUT request:

   ```
   PUT https://api.github.com/repos/{owner}/{repo}/contents/src/content/thoughts/{filename}
   Authorization: Bearer <PAT>
   Accept: application/vnd.github+json
   X-GitHub-Api-Version: 2022-11-28
   Content-Type: application/json
   ```

   Body:

   ```json
   {
     "message": "thought: <YYYY-MM-DD HH:mm> via q-sort",
     "content": "<base64>",
     "branch": "master"
   }
   ```

7. On `201 Created`: clear textarea, set status to `published — deploying (~2 min)`.
8. On non-2xx: set status to `error: <status> <message>`, keep textarea body intact, surface a Retry button.

### Storage

`localStorage` keys (page-scoped):

| Key | Value |
|-----|-------|
| `qsort.pat` | The fine-grained GitHub PAT, plain text. |
| `qsort.repo` | `owner/name` string, default `tumluliu/blogs`. |

No cookies. No IndexedDB.

### Service worker

Cache-first for the page shell and static assets:

- `/q-sort/`
- `/manifest.webmanifest`
- `/icons/q-sort-192.png`
- `/icons/q-sort-512.png`

Network-only for `api.github.com` (never cache writes).

Versioned cache name (e.g., `qsort-v1`); old caches deleted on `activate`.

## Error handling

| Scenario | Behavior |
|----------|----------|
| Empty body | Publish button disabled. |
| No PAT set | Status: `set PAT in settings`. Publish button disabled. |
| Network error | Status: `error: network — check connection`. Retry button. Body preserved. |
| 401 Unauthorized | Status: `error: PAT invalid or expired`. Retry button. Body preserved. |
| 403 / 404 | Status: `error: repo or scope wrong`. Retry button. Body preserved. |
| 422 (file already exists at path) | Status: `error: name collision; retry in a minute`. Retry button regenerates filename. |
| 5xx from GitHub | Status: `error: GitHub <code>; try again`. Retry button. |

## Security

- Page emits `<meta name="robots" content="noindex,nofollow">`.
- `public/robots.txt` adds `Disallow: /q-sort/`.
- Path `/q-sort/` is mildly obscured but treated as public (security-through-obscurity is not the protection layer).
- Real protection is the PAT scope: fine-grained, single repo `tumluliu/blogs`, permission `Contents: Write`, expiry 90 days.
- PAT lives in `localStorage` per device. Each device pastes its own copy via the settings modal.
- No server proxy: page calls GitHub API directly (CORS-supported).

## Acceptance criteria

A v1 implementation is complete when, on a fresh device:

1. Visiting `https://luliu.me/q-sort/` loads a page with a textarea and a Publish button.
2. With no PAT stored, the Publish button is disabled and the status line tells the user to open settings.
3. Pasting a valid PAT into the settings modal and saving enables Publish.
4. Typing text and clicking Publish writes a new file at `src/content/thoughts/YYYY-MM-DD-HHmm.md` on `master` with valid frontmatter, triggers the deploy workflow, and the thought appears on the live site within ~2 minutes.
5. The page can be installed to the Android home screen and launches fullscreen with the textarea autofocused.
6. With network disabled, the page shell still loads from the service worker; tapping Publish surfaces a network error gracefully.
7. After a successful publish, the textarea is cleared and the status line reads `published — deploying`.

## Testing

- **Manual**: end-to-end on Android Chrome (install + publish + verify on live site) and desktop Chrome (publish + verify).
- **Unit**: filename builder, frontmatter builder, base64 encoder for non-ASCII (CJK) input. Vitest, no DOM needed.
- **No e2e harness**: scope too small; manual verification suffices.

## Out of scope (deferred to v2+)

- PIN-encrypted PAT (Web Crypto + PBKDF2).
- Offline submission queue (IndexedDB; flush on reconnect).
- Tags input.
- Per-device PAT labels for granular revocation hygiene.
- Markdown preview.
- Push notification on deploy completion.
