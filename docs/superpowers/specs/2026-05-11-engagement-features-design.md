# Engagement Features — Design Spec

**Date**: 2026-05-11
**Status**: Approved (v1 scope locked)
**Author**: Lu Liu (with Claude)

## Problem

The modernised luliu.me ships posts and thoughts but offers no
engagement signal to readers or the author:

- No word count or reading-time hint.
- No way to register a "like".
- No share affordance.
- No page-view counter.

The author wants these four features on long-form posts to make the
site feel less inert and to get a coarse signal of what resonates,
without introducing tracking cookies, third-party analytics, or
account-gated interaction.

## Goal

Add, on `/posts/<slug>/` pages only:

1. **Word count + reading-time estimate** under the title.
2. **Like** button — anonymous +1, dedup'd via `localStorage`.
3. **Share** button — `navigator.share()` with copy-link fallback.
4. **Read count** — server-side increment on page load.

Keep the operational footprint small: one extra long-running process
on the existing Hetzner VM (a Go binary as a systemd unit, reverse-proxied
by the existing Caddy), one SQLite file for persistence.

## Non-goals (v1)

- Engagement chrome on `/thoughts/` (kept micro).
- Engagement chrome on index / tag / about pages.
- Like undo (anonymous counter; no client identity to verify a DELETE).
- Authenticated reactions (no login, no OAuth).
- Comments (different problem, different design).
- Per-country / per-referrer analytics dashboard.
- IP storage (rate limit only, in-memory).
- Docker on the VM (would undo a deliberate cleanup from the modernisation).

## Architecture

```
Browser (post page)
  ├─ on load:  POST /api/view/<slug>      → { views: N }      (read counter)
  ├─ on click: POST /api/like/<slug>      → { likes: N }      (Like)
  └─ on click: navigator.share() || copyLink()                (Share, no server)
                       │
                       ▼  via Caddy reverse proxy (/api/* → localhost:8787)
┌────────────────────────────────────────────────────────────┐
│  counter service (Go) on VM, systemd, localhost:8787       │
│  - GET  /api/stats/<slug>      → { views, likes }          │
│  - POST /api/view/<slug>       → { views }                 │
│  - POST /api/like/<slug>       → { likes }                 │
│  - GET  /api/_health           → "ok"                      │
│  - SQLite at /var/lib/counter/counter.db (WAL mode)        │
│  - In-memory token bucket per IP (no IP persisted)         │
└────────────────────────────────────────────────────────────┘
```

### Repo layout additions

```
blogs/
├── infra/
│   ├── Caddyfile                       # add /api/* handle block
│   ├── vm-bootstrap.sh                 # extend: counter user, /var/lib/counter, systemd unit
│   └── services/
│       └── counter/
│           ├── go.mod
│           ├── main.go
│           ├── handler.go
│           ├── store.go
│           ├── ratelimit.go
│           ├── *_test.go
│           └── counter.service          # systemd unit
├── src/
│   ├── components/
│   │   └── PostEngagement.astro         # word count + like + share + view UI
│   ├── lib/
│   │   ├── reading-stats.ts
│   │   └── reading-stats.test.ts
│   └── scripts/
│       ├── engagement.ts                # client-side fetch/wire-up
│       └── engagement.test.ts
└── .github/workflows/
    ├── deploy.yml                       # add: build counter, rsync, restart, healthcheck
    └── counter-backup.yml               # new: nightly SQLite snapshot to workflow artifact
```

## Counter service (Go + SQLite)

### Endpoints

All JSON. CORS: `Access-Control-Allow-Origin: https://luliu.me`,
`Access-Control-Allow-Methods: GET, POST`, no credentials.

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| `GET`  | `/api/stats/{slug}` | – | `{views, likes}` | `Cache-Control: public, max-age=30`. |
| `POST` | `/api/view/{slug}` | – | `{views}` | Rate-limited; bot-filtered. |
| `POST` | `/api/like/{slug}` | – | `{likes}` | Rate-limited; per-IP one-shot. |
| `GET`  | `/api/_health` | – | `"ok"` | Plain text. Used by CI post-deploy probe. |

### Slug validation

Regex `^[\p{L}\p{N}\-_]{1,200}$` (Unicode letter/number plus hyphen
and underscore, length cap 200). Rejects path traversal (`..`, `/`),
unbounded keys, and odd punctuation. CJK accepted (slug derivation
on the blog can yield CJK characters; see the loader's slug rule).

### Schema

```sql
CREATE TABLE counters (
  slug       TEXT PRIMARY KEY,
  views      INTEGER NOT NULL DEFAULT 0,
  likes      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL          -- unix seconds
);
```

Atomic increment:
```sql
INSERT INTO counters(slug, views, likes, updated_at)
VALUES (?, ?, 0, ?)
ON CONFLICT(slug) DO UPDATE SET
  views      = views + excluded.views,
  updated_at = excluded.updated_at;
```
(Mirror for `likes`.)

Unknown slug → row auto-created on first increment. No allowlist sync
with the post list.

### Rate limiting (in-memory, no persistence)

- **Per-IP token bucket**: 30 POSTs / minute. Excess → 429.
- **View dedup**: per `(IP, slug)` view counted at most 1× / 30 min.
  Absorbs reloads.
- **Like dedup**: per `(IP, slug)` like counted at most 1× since last
  service start. Persistence sits on the client (`localStorage`); the
  in-memory map is a secondary belt that fades on restart.
- Buckets are plain `map[string]bucket` guarded by a mutex; LRU evicts
  at 10k entries.

### Bot filter

`POST /api/view/...` is dropped (return `{views: <current>}` without
increment) when:

- `User-Agent` matches `(?i)(bot|crawler|spider|preview|wget|curl)`
- `Sec-Fetch-Site` header absent **and** `User-Agent` lacks
  `Mozilla/` (heuristic, removes naive scrapers).

Bot filter does **not** apply to `like` — bots don't usually click
buttons, and any false positive on a real click is worse than a stray
view drop.

### Recovery on errors

- Panics → `recover` middleware logs and returns 500. Service stays up.
- SQLite `database is locked` → retry 3× with 5 ms jitter, then 503.
- Disk full / DB corrupt → POSTs 503; `GET /api/stats` falls back to
  the last value held in a tiny in-memory cache (populated on every
  successful read or write).

## Caddyfile change

Add one handle block to the existing `luliu.me {}` site:

```
handle /api/* {
    reverse_proxy localhost:8787
    request_body { max_size 1KB }
}
```

`request_body` cap rejects bodies bigger than empty — POSTs in this
design carry no body.

## systemd unit

`infra/services/counter/counter.service`:
```ini
[Unit]
Description=luliu.me engagement counter service
After=network.target

[Service]
Type=simple
User=counter
Group=counter
ExecStart=/opt/counter/counter
Restart=on-failure
RestartSec=2s
StateDirectory=counter
Environment=COUNTER_DB=/var/lib/counter/counter.db
Environment=COUNTER_ADDR=127.0.0.1:8787

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/counter

[Install]
WantedBy=multi-user.target
```

## One-time VM bootstrap

Extension to `infra/vm-bootstrap.sh` (idempotent — safe to re-run):

1. `useradd --system --home-dir /var/lib/counter --shell /usr/sbin/nologin counter`
2. `install -d -o counter -g counter -m 0750 /var/lib/counter /opt/counter`
3. `install -m 0644 counter.service /etc/systemd/system/counter.service`
4. Append the `/api/*` block to the Caddy site config; `systemctl reload caddy`.
5. `systemctl enable counter`. (Service starts after first CI deploy
   places the binary.)

Run once via single SSH session. Documented in
`docs/obsidian-workflow.md` follow-on or `infra/README.md`.

## CI deploy changes

`.github/workflows/deploy.yml` gains a parallel job (after the
existing static build/rsync):

1. `actions/setup-go@v5`
2. `go test ./infra/services/counter/...`
3. `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o counter ./infra/services/counter`
4. `rsync` binary to VM `/opt/counter/counter` (via existing deploy key)
5. `rsync` `counter.service` to `/etc/systemd/system/`
6. `ssh systemctl daemon-reload && systemctl restart counter`
7. Healthcheck: curl `https://luliu.me/api/_health` until 200 or 30 s
   timeout. Non-200 → CI red, easy redeploy.

`.github/workflows/counter-backup.yml` (new): cron `0 3 * * *`. `rsync`
`/var/lib/counter/counter.db` (and its `.bak` snapshot) from VM to a
workflow artifact with 90-day retention.

VM-side companion: systemd timer `counter-backup.timer` runs daily
`sqlite3 counter.db ".backup '/var/lib/counter/counter.db.bak'"` so
the rsync grabs a consistent snapshot without racing live writers.

## Frontend integration

### Astro component

`src/components/PostEngagement.astro`, rendered once at the bottom of
`src/pages/posts/[...slug].astro` body, **above** any future
comments section:

```astro
---
const { slug, words, minutes } = Astro.props;
---
<aside class="engagement" data-slug={slug}>
  <div class="stats">
    <span class="views" aria-label="阅读次数">— 次阅读</span>
    <span class="words">{words.toLocaleString()} 字</span>
  </div>
  <div class="actions">
    <button class="like-btn" aria-pressed="false">
      <span aria-hidden="true">♡</span> <span class="count">—</span>
    </button>
    <button class="share-btn">分享</button>
  </div>
</aside>
<script src="../scripts/engagement.ts"></script>
```

Bare `<script>` with a relative import — bundled by Vite per Astro's
script-processing rules (already documented in repo memory:
`astro_script_bundling.md`).

### Page integration

`src/pages/posts/[...slug].astro` change:

```astro
import { readingStats } from '../../lib/reading-stats';
import PostEngagement from '../../components/PostEngagement.astro';

const { words, minutes } = readingStats(post.body ?? '');
const stableSlug = post.data.slug ?? post.id;
---
…
<Content />
<PostEngagement slug={stableSlug} words={words} minutes={minutes} />
```

Reading-time chip appears once, under the post date row (existing
`<p class="post-meta">`): `… · 约 {minutes} 分钟读完`. The
`PostEngagement` block at the bottom shows word count (`字`),
view count, like, and share — but **not** reading time, to avoid
duplication.

### Client script (`src/scripts/engagement.ts`)

1. On `DOMContentLoaded`:
   - Read `data-slug`.
   - `GET /api/stats/<slug>` → fill `.views` and `.like-btn .count`.
   - Fire-and-forget `POST /api/view/<slug>`; on 2xx, optimistically
     bump the displayed view count.
   - If `localStorage.getItem('liked:<slug>')`: set
     `aria-pressed=true`, disable click.

2. Like click:
   - If already pressed → no-op (no undo, per design).
   - Optimistic +1, set `aria-pressed=true`, `localStorage.setItem`.
   - `POST /api/like/<slug>`.
   - On 4xx/5xx: revert state, remove `localStorage`, toast `稍后再试`.

3. Share click:
   - If `navigator.share`: call with `{title: document.title, url: location.href}`.
   - Else: `navigator.clipboard.writeText(location.href)` + toast `已复制链接`.

Failure modes are silent. The page is fully readable with the API
unreachable; counts stay `—`, console.warn only.

## Word count + reading time (CJK-aware)

`src/lib/reading-stats.ts`:

```ts
export function readingStats(markdown: string): { words: number; minutes: number } {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1');

  const cjk = (prose.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const ascii = (prose.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? []).length;
  const words = cjk + ascii;
  const minutes = Math.max(1, Math.round(cjk / 300 + ascii / 200));
  return { words, minutes };
}
```

Constants: 300 CJK chars/min, 200 ASCII words/min (standard mixed
formula). Pure build-time, no runtime cost.

Display split: `约 5 分钟读完` next to the post date row; `1,240 字`
in the engagement block at post bottom.

Limitation: cnblogs-imported posts contain raw HTML which leaks into
the count as text noise. Acceptable — stats are signals, not
measurements.

## Error handling summary

| Layer | Failure | Behaviour |
|---|---|---|
| Service handler | panic | recover middleware → 500 + log, service stays up |
| Service write | SQLite locked | retry 3× w/ jitter, then 503 |
| Service write | disk full / corrupt DB | POST 503; GET serves in-memory cache |
| Service input | bad slug | 400 `{error:"bad slug"}` (no internal leak) |
| Service input | rate-limit hit | 429 (client suppresses toast) |
| Client | API unreachable | `—` stays, page readable, console.warn only |
| Client | CORS hiccup | swallowed, console.warn only |
| Client | localStorage blocked | Like works, no client dedup, server soft cap absorbs |
| CI | service down after deploy | healthcheck fails → CI red |

## Testing strategy

### Go service (`infra/services/counter/*_test.go`)

Table-driven tests against in-memory SQLite (`:memory:`):

- `view` increments by 1, second hit same `(IP, slug)` within window → no-op.
- `like` increments by 1, repeat same `(IP, slug)` → 429.
- `stats` returns counts for known + unknown slug.
- Slug regex: CJK accept, traversal reject, length cap reject.
- Rate-limit bucket refill.

Handler integration via `httptest.NewServer`:

- CORS preflight returns `Access-Control-Allow-Origin: https://luliu.me`.
- Bot UA filter drops view increment.
- Concurrent 100 likes from 100 distinct IPs → exactly 100 increments
  (race detector on).

CI: `go test -race ./infra/services/counter/...` blocks deploy.

### Frontend (`src/lib/reading-stats.test.ts`, Vitest)

- Pure-CJK 500 chars → `words=500, minutes≈2`.
- Pure-English 500 words → `words=500, minutes≈3`.
- Mixed → checked vs hand-computed.
- Code fence + image-link stripped.

### Engagement client (`src/scripts/engagement.test.ts`, Vitest + jsdom)

- Mocked fetch: stats hydrate, view fires once, like 2xx persists to
  localStorage, like 4xx reverts UI.
- localStorage gating: pre-set `liked:<slug>` → button disabled at boot.
- Share button: `navigator.share` defined → calls it; undefined →
  falls back to clipboard.

### Manual smoke (post-deploy, one-time per release)

- Curl `/api/stats/test`; refresh a post; verify view count tick.
- Like from one browser; refresh; button stays pressed.
- Share button: native sheet on Android Chrome; clipboard on desktop.

### Out of scope

- Caddy config (trust upstream).
- systemd unit lifecycle (trust upstream).
- SQLite itself.

## Open questions

None — all decisions locked at brainstorming. Bootstrap-script PR
order will be sequenced in the writing-plans phase.
