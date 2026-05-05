# Blog Modernization Design

**Date**: 2026-05-05
**Author**: Lu Liu
**Status**: Proposed (awaiting review)

## 1. Goal

Modernize https://luliu.me — currently Hexo on Ubuntu 18.04 in Docker on a Hetzner Cloud cx21 VM — into a maintainable, image-capable, schema-validated, multi-content-type personal site, while:

- Importing 164 archived posts from https://www.cnblogs.com/rib06 into the same site.
- Adding a microblog ("thoughts") stream alongside long-form posts.
- Reducing operational surface on the VM.
- Preserving all existing content (the 58 posts in this repo and the customizations on the VM that have no other backup).

URL preservation is **not** a hard requirement (decided during brainstorming).

## 2. Decisions

| Topic | Decision |
|---|---|
| Static site generator | **Astro 5** |
| Hosting | Same Hetzner Cloud cx21, **rebuilt** to fresh Ubuntu 24.04 |
| Web server | **Caddy** (auto-HTTPS, single binary, ~10-line config) |
| Build location | **GitHub Actions** (VM no longer runs Node/Hexo) |
| Deploy mechanism | **rsync over SSH** from CI to VM, push-driven (replaces cron-pull) |
| Content authoring | **Obsidian** in this repo (vault root = repo root) |
| Frontmatter management | **Schema-validated** (Astro content collections, Zod). No web CMS. |
| Image storage | **In-repo, per-post subfolder**, build-time optimized by Astro |
| Microblog | **Same repo**, separate content collection `thoughts/` |
| Aggregation | **One-shot import** of cnblogs posts via MetaWeblog API |
| Aggregated posts treatment | Mixed timeline with original 58 posts (backdated) |
| Section naming | `posts` + `thoughts` (both plural collections) |
| Landing page (`/`) | About intro + recent posts + recent thoughts |

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Author machine (Lu's laptop)                                │
│  - Obsidian vault rooted at /Users/luliu/projects/blogs      │
│  - Edits MD, pastes images into per-post subfolder           │
│  - Optional CLI scripts in scripts/ for bulk operations      │
└─────────────────────────────────────────────────────────────┘
                       │  git push
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub repo `luliu/blogs`                                   │
│  - src/content/posts/*.md  (long posts)                      │
│  - src/content/thoughts/*.md  (microblog)                    │
│  - src/content/posts/<slug>/<image>  (per-post images)       │
│  - astro.config.mjs, layouts, components                     │
│                                                              │
│  GitHub Actions on push to master:                           │
│   1. checkout                                                │
│   2. pnpm install + astro build                              │
│   3. rsync dist/ to VM:/var/www/luliu.me                     │
└─────────────────────────────────────────────────────────────┘
                       │  rsync over SSH (deploy key)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Hetzner Cloud cx21, fresh Ubuntu 24.04                      │
│  - Caddy serving /var/www/luliu.me (static)                  │
│  - ufw: 22, 80, 443                                          │
│  - NO docker, NO node, NO hexo                               │
└─────────────────────────────────────────────────────────────┘
```

## 4. Repo Layout

```
blogs/
├── .github/workflows/deploy.yml
├── .obsidian/                            # vault config (preserved)
├── .gitignore
├── astro.config.mjs
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── README.md
│
├── src/
│   ├── content/
│   │   ├── config.ts                     # collection schemas (Zod)
│   │   ├── posts/
│   │   │   ├── 2016.md
│   │   │   ├── da-shu-ju-de-xian-jing.md
│   │   │   ├── da-shu-ju-de-xian-jing/   # optional, only if has images
│   │   │   │   └── cover.jpg
│   │   │   └── ...
│   │   └── thoughts/
│   │       └── 2026-05-05-1023.md
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── PostLayout.astro
│   │   └── ThoughtLayout.astro
│   │
│   ├── components/
│   │   ├── PostCard.astro
│   │   ├── ThoughtCard.astro
│   │   ├── Header.astro
│   │   └── Footer.astro
│   │
│   ├── pages/
│   │   ├── index.astro                   # landing
│   │   ├── posts/
│   │   │   ├── index.astro               # post list
│   │   │   └── [...slug].astro           # post detail
│   │   ├── thoughts/
│   │   │   ├── index.astro               # microblog feed
│   │   │   └── rss.xml.ts
│   │   ├── tags/[tag].astro
│   │   ├── rss.xml.ts
│   │   └── sitemap.xml.ts
│   │
│   └── styles/global.css
│
├── public/                               # static passthrough (favicon, robots.txt)
│
├── scripts/
│   ├── new-post.ts                       # CLI: scaffold MD with frontmatter
│   ├── new-thought.ts
│   ├── rename-to-slug.ts                 # one-shot Chinese → ASCII slug
│   └── import-cnblogs.ts                 # one-shot cnblogs import
│
├── infra/
│   ├── Caddyfile                         # VM web server config
│   ├── deploy-key.pub                    # GH Actions SSH public key
│   └── vm-bootstrap.sh                   # provisioning for fresh VM
│
└── docs/
    ├── obsidian-workflow.md              # author workflow reference
    └── superpowers/specs/2026-05-05-blog-modernization-design.md  # this file
```

## 5. Content Schema

`src/content/config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
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

Build fails on schema violation. Bad frontmatter cannot reach production.

## 6. Image Pipeline

- Author flow: Obsidian configured to save attachments to "subfolder under current folder, named after current note". Pasted images land in `src/content/posts/<slug>/`.
- Markdown reference: `![alt](./<slug>/cover.png)` (Obsidian inserts automatically).
- Build: Astro `astro:assets` auto-processes relative image refs in content-collection MD: generates AVIF/WebP/fallback, multiple widths, sets `width`/`height`, lazy-loads.
- Repo growth bound: `.gitattributes` declares image extensions binary. Soft cap ~200 MB. Hard cap action: any single image >5 MB flagged for manual review by import script.

## 7. Microblog ("Thoughts")

- Storage: `src/content/thoughts/<YYYY-MM-DD-HHmm>.md`. Filename = ISO timestamp, naturally sortable.
- Frontmatter: just `date` and optional `tags`. No title.
- Rendering: reverse-chronological feed at `/thoughts/`. Each entry shows date + body. Permalink anchor `#<timestamp>` for linking individual thoughts. No standalone detail page per thought.
- Separate RSS at `/thoughts/rss.xml`.

## 8. cnblogs Aggregation

Source: 159 posts + 5 articles = 164 items at https://www.cnblogs.com/rib06.

### Pipeline (run on `import/cnblogs` branch, idempotent phases)

**Phase 1 — Fetch via MetaWeblog XML-RPC**
- Endpoint: `https://rpc.cnblogs.com/metaweblog/<username>`
- Auth: cnblogs username + MetaWeblog access password (set in cnblogs admin → 设置 → MetaBlog设置).
- Call `metaWeblog.getRecentPosts(blogid, user, pwd, 9999)`.
- Cache raw XML response per post to `scripts/cnblogs-cache/<post-id>.xml` (gitignored).
- Re-runnable; skips already-cached IDs.

**Phase 2 — Convert HTML to Markdown**
- For each cached post: extract `title`, `dateCreated`, `categories`, `mt_keywords`, `description` (HTML body), `permalink`.
- HTML → Markdown via `pandoc` subprocess. Best fidelity for nested lists, code blocks, tables.
- Slug via shared pinyin function (see §10).
- Write `src/content/posts/<slug>.md` with frontmatter:
  ```yaml
  title: <original Chinese title>
  slug: <pinyin slug>
  date: <dateCreated>
  tags: [<categories + keywords, normalized>]
  source: cnblogs
  sourceUrl: <permalink>
  draft: false
  ```
- Slug collision with existing posts: stop and report; require manual decision.

**Phase 3 — Image localization**
- Scan converted MDs for `<img src="https://*.cnblogs.com/...">` and `![](https://*.cnblogs.com/...)`.
- Download to `src/content/posts/<slug>/img-N.<ext>` at 1 req/sec.
- Rewrite MD references to relative paths.
- Failures logged to `scripts/cnblogs-cache/image-failures.log`; original URL retained as fallback.

**Phase 4 — Validate**
- `pnpm build` succeeds → schema valid for all 222 posts.
- Spot-check 5 random imported posts: dev preview vs cnblogs original.
- Tag normalization confirmed; mixed-timeline ordering correct.

## 9. Build & Deploy

### GitHub Actions `.github/workflows/deploy.yml`

```yaml
name: deploy
on:
  push:
    branches: [master]
    paths-ignore: ['docs/**', 'README.md', '.obsidian/**', 'infra/**', 'scripts/**']

concurrency:
  group: deploy-prod
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 1 }

      - uses: pnpm/action-setup@v4
        with: { version: 9 }

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Smoke check dist
        run: |
          test -f dist/index.html
          test -f dist/posts/index.html
          test -f dist/rss.xml
          [ "$(find dist -name '*.html' | wc -l)" -gt 50 ]

      - name: Setup SSH
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H ${{ secrets.VM_HOST }} >> ~/.ssh/known_hosts

      - name: Rsync to VM
        run: |
          rsync -az --delete \
            --exclude='.well-known' \
            ./dist/ \
            deploy@${{ secrets.VM_HOST }}:/var/www/luliu.me/

      - name: Reload web server
        run: ssh deploy@${{ secrets.VM_HOST }} 'sudo systemctl reload caddy'
```

### GitHub repo secrets

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | Private ed25519 keypair, dedicated to this workflow |
| `VM_HOST` | VM IP or `luliu.me` |

### VM bootstrap `infra/vm-bootstrap.sh`

```bash
#!/bin/bash
set -euo pipefail

# Run once on fresh Ubuntu 24.04 as root
apt-get update && apt-get upgrade -y
apt-get install -y caddy ufw rsync

useradd -m -s /bin/bash deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
# Manually populate /home/deploy/.ssh/authorized_keys with GH Actions public key

mkdir -p /var/www/luliu.me
chown -R deploy:deploy /var/www/luliu.me

echo 'deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload caddy' > /etc/sudoers.d/deploy-caddy
chmod 440 /etc/sudoers.d/deploy-caddy

cat > /etc/caddy/Caddyfile <<'EOF'
luliu.me, www.luliu.me {
    root * /var/www/luliu.me
    file_server
    encode gzip zstd
    redir /www.luliu.me /luliu.me 301

    @notfound {
        not file
        not path /
    }
    handle @notfound {
        rewrite * /404.html
        file_server
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Cache-Control "public, max-age=3600"
    }
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
}
EOF

systemctl enable --now caddy

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 10. Migration Scripts

### `scripts/rename-to-slug.ts`

Robustness requirements:
1. Idempotent — second run is a no-op.
2. Library: `pinyin` (npm) for Chinese → ASCII transliteration (no tone marks, lowercase, hyphenated).
3. Collision detection — colliding slugs get `-2`, `-3` suffix; conflicts shown in dry-run output.
4. Original Chinese title preserved in `title:` frontmatter field before rename.
5. Length cap: 60 chars max, truncated at word boundary.
6. Dry-run mode is default; `--apply` flag required to mutate.
7. Uses `git mv` so history follows the rename.
8. Adds explicit `slug:` field in frontmatter post-rename so URLs survive future filename edits.
9. Skips already-ASCII filenames unless they have spaces.
10. Does not modify post body — only frontmatter and filename.
11. Creates branch `pre-rename-backup` before any changes if not already on a feature branch.

### `scripts/new-post.ts` and `scripts/new-thought.ts`

CLI alternatives to Obsidian Templater. Scaffold MD file with valid frontmatter (correct date, slug, draft state). ~50 LOC each.

### `scripts/import-cnblogs.ts`

Multi-phase as described in §8. Each phase invokable via `pnpm import-cnblogs:<phase>`.

## 11. Theme / UI

Build minimal custom Astro theme; do not port old Hexo theme.

- Single-column body, max-width ~700px.
- Typography-first: serif body (system + Source Han Serif for CJK), monospace code, sans-serif chrome.
- Light + dark modes via `prefers-color-scheme` + manual toggle (localStorage).
- No JavaScript for content; JS only for theme toggle.
- No analytics/tracking by default.
- ~10 components, ~300 LOC total estimated.

### Pages

| Path | Renders |
|---|---|
| `/` | About intro + 5 recent posts + 5 recent thoughts |
| `/posts/` | Reverse-chrono post list, paginated 20/page |
| `/posts/<slug>/` | Individual post |
| `/thoughts/` | Reverse-chrono thoughts feed |
| `/tags/<tag>/` | All posts/thoughts with that tag |
| `/about/` | Static page |
| `/rss.xml` | Posts RSS |
| `/thoughts/rss.xml` | Thoughts RSS |
| `/sitemap-index.xml` | Auto via `@astrojs/sitemap` |
| `/404.html` | Custom 404 |

### Out of scope (deferred)

- Full-text search (later via Pagefind)
- Comments (Giscus / Utterances)
- View counts (GoatCounter)
- Web fonts (start with system stack)

## 12. Obsidian Workflow

Detailed in `docs/obsidian-workflow.md` (separate file). Summary:

- Vault root = repo root.
- `Settings → Files & Links → Default location for new notes`: `src/content/posts`.
- `Settings → Files & Links → Default location for new attachments`: subfolder under current folder.
- Recommended plugins: **Templater** (auto frontmatter), **Obsidian Git** (one-click commit/push).
- Daily flow: `Cmd+N` → write → paste images → `Cmd+P` → "Git: Commit and push" → live in ~1 min.

## 13. Migration Order + No-Data-Loss Safeguards

```
[1]  Branch `astro-migration` (master untouched)
[2]  VM discovery + backup        (read-only on VM, copy to local + Hetzner snapshot)
[3]  Verify backup locally        (stand up old hexo from backup → renders)
[4]  Astro project scaffold
[5]  Migrate 58 existing posts    (rename-to-slug, normalize tags, mark empties draft)
[6]  cnblogs import               (3-phase pipeline on import/cnblogs branch, then merge)
[7]  Local build green            (pnpm build → 0 errors, 222 posts validate)
[8]  Local preview review         (manual spot-check + visual approval)
[9]  Hetzner rebuild VM           (Console → Rebuild → Ubuntu 24.04, ~5 min)
[10] VM bootstrap + first deploy  (run vm-bootstrap.sh, push triggers GH Actions)
[11] Cutover verification         (curl checks, TLS, RSS, sitemap, 10 random posts)
[12] Hold backup + snapshot 7 days, then cleanup
```

### Verification gates

| Gate | Pass condition |
|---|---|
| After [3] | Old Hexo site renders locally from backup. |
| After [5] | `git diff` shows only frontmatter+filename changes; total body word count within 1% of pre-migration. |
| After [6] | Imported post count = 164 or skips reported with reasons. |
| After [7] | `pnpm build` exits 0. |
| After [8] | Author signs off on visual preview. |
| After [10] | `curl https://luliu.me` returns 200, valid TLS. |
| After [11] | All cutover checks pass (enumerated below). |

#### Cutover checks (step 11)

1. `curl -I https://luliu.me` → `200 OK`.
2. TLS cert valid for `luliu.me` and `www.luliu.me` (`curl -vI https://luliu.me 2>&1 | grep 'subject:'`).
3. `https://www.luliu.me` redirects to `https://luliu.me`.
4. `/posts/` lists posts in reverse-chrono order; total count = 222 (58 + 164).
5. 10 randomly-sampled post URLs return 200 and render content.
6. At least one post with images renders images (not 404 / broken).
7. `/thoughts/` returns 200 (even if empty initially).
8. `/rss.xml` returns 200, valid XML, contains recent post titles.
9. `/sitemap-index.xml` returns 200, lists all post URLs.
10. `/404.html` served for unknown paths with HTTP 404.
11. Lighthouse / `curl -w '%{time_total}'` page load under 1s for `/`.
12. No requests to old Hexo paths in Caddy access log (sanity check that DNS still points to right server).

### Rollback paths

| Failure | Recovery |
|---|---|
| Step 5 corrupts content | `git reset --hard` on migration branch (master untouched) |
| Step 6 partial import | Re-run, idempotent. Or skip and add manually later. |
| Step 9 rebuild fails | Hetzner snapshot restore (~5 min) |
| Step 10 bootstrap broken | Re-rebuild + re-run; state in `vm-bootstrap.sh`, reproducible. |
| Step 11 site looks wrong | Rsync old hexo dist from local backup → reverts. Or full snapshot restore. |

### Preservation guarantees

- Local `~/vm-backup-2026-05-05/` retained ≥30 days post-cutover.
- Hetzner snapshot retained ≥7 days post-cutover.
- Old `master` branch tagged `pre-astro-migration` before merge.

## 14. Out of Scope

- Web CMS / dashboard for editing posts via browser.
- Comments / federation / Mastodon integration.
- Analytics or tracking.
- Search (deferred to v2 with Pagefind).
- Custom domain changes.
- Multilingual support (i18n) — content is mixed Chinese + English; no translation.

## 15. Open Items / Decisions Deferred

- Exact `astro.config.mjs` plugins list (locked when scaffolding in implementation phase).
- Whether to enable view counts via GoatCounter (decide post-launch).
- Pagefind integration timing (post-launch).
- Whether Obsidian Templater fully replaces `scripts/new-post.ts` or both coexist (both kept; Templater is for in-Obsidian flow, CLI for terminal flow).
