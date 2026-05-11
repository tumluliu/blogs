# Engagement Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add word count + reading time, anonymous Like, Share, and server-side page-view counter to long-form posts on luliu.me, backed by a tiny Go+SQLite service on the existing Hetzner VM.

**Architecture:** Build-time CJK-aware reading stats in TS; an Astro component renders engagement chrome at the bottom of `/posts/<slug>/`; a bare `<script>` (relative import → Vite-bundled) calls a self-hosted Go service via Caddy reverse-proxy at `/api/*`. Service stores per-slug `(views, likes)` in SQLite (WAL), rate-limits in memory, never persists IPs. CI deploys the binary via the same SSH/rsync flow as the static site.

**Tech Stack:** TypeScript + Astro 6 (frontend), Vitest + jsdom (tests), Go 1.22 + `modernc.org/sqlite` (service), systemd, Caddy 2, GitHub Actions.

---

## Pre-flight

- [ ] **Step 0a: Confirm clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`

- [ ] **Step 0b: Confirm spec is committed**

Run: `git log --oneline -- docs/superpowers/specs/2026-05-11-engagement-features-design.md`
Expected: at least one commit (`45794f0 docs(spec): engagement features design …`).

---

### Task 1: Reading-stats library (CJK-aware word count + minutes)

**Files:**
- Create: `src/lib/reading-stats.ts`
- Create: `src/lib/reading-stats.test.ts`

Vitest already includes `src/**/*.test.ts` per `vitest.config.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reading-stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readingStats } from './reading-stats';

describe('readingStats', () => {
  it('counts pure CJK characters and estimates minutes', () => {
    const text = '中'.repeat(500);
    const { words, minutes } = readingStats(text);
    expect(words).toBe(500);
    // 500 / 300 ≈ 1.67 → round → 2
    expect(minutes).toBe(2);
  });

  it('counts pure ASCII words and estimates minutes', () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const { words, minutes } = readingStats(text);
    expect(words).toBe(500);
    // 500 / 200 = 2.5 → round → 3
    expect(minutes).toBe(3);
  });

  it('combines CJK chars and ASCII words', () => {
    const text = '中'.repeat(300) + ' ' + Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
    const { words, minutes } = readingStats(text);
    expect(words).toBe(400);
    // 300/300 + 100/200 = 1 + 0.5 = 1.5 → round → 2
    expect(minutes).toBe(2);
  });

  it('strips fenced code blocks', () => {
    const text = '中'.repeat(100) + '\n```js\nconsole.log("hello");\n```\n' + '中'.repeat(100);
    const { words } = readingStats(text);
    expect(words).toBe(200);
  });

  it('strips inline code', () => {
    const text = '中文 `code that should not count` 中文';
    const { words } = readingStats(text);
    // 中文 + 中文 = 4 CJK chars; ASCII inside backticks dropped
    expect(words).toBe(4);
  });

  it('strips image refs but keeps link text', () => {
    const text = '看 ![alt text](/img.png) 这个 [点这里](https://example.com)';
    const { words } = readingStats(text);
    // CJK: 看, 这, 个, 点, 这, 里 = 6; ASCII stripped from images, kept from link text but link text is CJK
    expect(words).toBe(6);
  });

  it('returns minutes >= 1 for tiny inputs', () => {
    expect(readingStats('').minutes).toBe(1);
    expect(readingStats('hi').minutes).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/reading-stats.test.ts --run`
Expected: FAIL with `Cannot find module './reading-stats'` or similar.

- [ ] **Step 3: Write the implementation**

Create `src/lib/reading-stats.ts`:

```ts
// CJK-aware reading statistics for blog posts. Mixed-language formula:
//   words   = CJK chars + ASCII words
//   minutes = round(CJK / 300 + ASCII / 200), min 1
// Standard reading speeds (CJK chars/min and English words/min).

export function readingStats(markdown: string): { words: number; minutes: number } {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, '')         // fenced code
    .replace(/`[^`]*`/g, '')                // inline code
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')    // images
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1'); // link → text only

  const cjk = (prose.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  const ascii = (prose.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? []).length;
  const words = cjk + ascii;
  const minutes = Math.max(1, Math.round(cjk / 300 + ascii / 200));
  return { words, minutes };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/reading-stats.test.ts --run`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reading-stats.ts src/lib/reading-stats.test.ts
git commit -m "feat(reading-stats): CJK-aware word count + reading time"
```

---

### Task 2: Reading-time chip on post page

**Files:**
- Modify: `src/pages/posts/[...slug].astro`

- [ ] **Step 1: Add reading-time chip into the post-meta row**

Replace the existing frontmatter + meta block in `src/pages/posts/[...slug].astro` with:

```astro
---
import { type CollectionEntry, getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { readingStats } from '../../lib/reading-stats';

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
const { minutes } = readingStats(post.body ?? '');

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
---
<BaseLayout title={`${post.data.title} — luliu.me`}>
  <article>
    <h1>{post.data.title}</h1>
    <p class="post-meta">
      <span>{fmt(post.data.date)}</span>
      <span> · 约 {minutes} 分钟读完</span>
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

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: build succeeds; 255 pages built; no errors.

- [ ] **Step 3: Spot-check a built page**

Run: `grep -o '约 [0-9]\+ 分钟读完' dist/posts/why-not-wechat/index.html | head -1`
Expected: a line like `约 6 分钟读完`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/posts/\[...slug\].astro
git commit -m "feat(posts): show reading time under post date"
```

---

### Task 3: Counter service — Go project skeleton + store with TDD

**Files:**
- Create: `infra/services/counter/go.mod`
- Create: `infra/services/counter/store.go`
- Create: `infra/services/counter/store_test.go`

- [ ] **Step 1: Initialize Go module**

Run:
```bash
mkdir -p infra/services/counter
cd infra/services/counter
go mod init github.com/tumluliu/blogs/infra/services/counter
go get modernc.org/sqlite@latest
cd -
```

Expected: `go.mod` + `go.sum` created; module path set; `modernc.org/sqlite` added (pure-Go driver, no cgo).

- [ ] **Step 2: Write failing store tests**

Create `infra/services/counter/store_test.go`:

```go
package main

import (
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := OpenStore(":memory:")
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestStore_StatsUnknownSlugReturnsZeros(t *testing.T) {
	s := newTestStore(t)
	views, likes, err := s.Stats("never-seen")
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if views != 0 || likes != 0 {
		t.Fatalf("want (0,0), got (%d,%d)", views, likes)
	}
}

func TestStore_IncrViewCreatesRowAndIncrements(t *testing.T) {
	s := newTestStore(t)
	v1, err := s.IncrView("post-a")
	if err != nil || v1 != 1 {
		t.Fatalf("first IncrView: got %d err=%v", v1, err)
	}
	v2, err := s.IncrView("post-a")
	if err != nil || v2 != 2 {
		t.Fatalf("second IncrView: got %d err=%v", v2, err)
	}
	views, likes, _ := s.Stats("post-a")
	if views != 2 || likes != 0 {
		t.Fatalf("Stats after 2 views: got (%d,%d) want (2,0)", views, likes)
	}
}

func TestStore_IncrLikeIndependentOfViews(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.IncrView("post-b"); err != nil {
		t.Fatalf("IncrView: %v", err)
	}
	l, err := s.IncrLike("post-b")
	if err != nil || l != 1 {
		t.Fatalf("IncrLike: got %d err=%v", l, err)
	}
	views, likes, _ := s.Stats("post-b")
	if views != 1 || likes != 1 {
		t.Fatalf("Stats: got (%d,%d) want (1,1)", views, likes)
	}
}

func TestStore_DistinctSlugsAreIsolated(t *testing.T) {
	s := newTestStore(t)
	s.IncrView("a")
	s.IncrView("a")
	s.IncrLike("b")
	va, la, _ := s.Stats("a")
	vb, lb, _ := s.Stats("b")
	if va != 2 || la != 0 {
		t.Fatalf("a: got (%d,%d) want (2,0)", va, la)
	}
	if vb != 0 || lb != 1 {
		t.Fatalf("b: got (%d,%d) want (0,1)", vb, lb)
	}
}
```

- [ ] **Step 3: Run to verify failure**

Run: `cd infra/services/counter && go test ./... && cd -`
Expected: FAIL with `undefined: Store` / `undefined: OpenStore`.

- [ ] **Step 4: Implement the store**

Create `infra/services/counter/store.go`:

```go
package main

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func OpenStore(dsn string) (*Store, error) {
	// modernc driver name is "sqlite"; "?_pragma=…" sets pragmas at open time.
	connStr := dsn + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(2000)&_pragma=synchronous(NORMAL)"
	if dsn == ":memory:" {
		// in-memory DB can't be WAL, drop that pragma
		connStr = dsn
	}
	db, err := sql.Open("sqlite", connStr)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(1) // SQLite single-writer; serialise everything.
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS counters (
			slug       TEXT PRIMARY KEY,
			views      INTEGER NOT NULL DEFAULT 0,
			likes      INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL
		);
	`); err != nil {
		db.Close()
		return nil, fmt.Errorf("create table: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Stats(slug string) (views, likes int64, err error) {
	row := s.db.QueryRow(`SELECT views, likes FROM counters WHERE slug = ?`, slug)
	if err := row.Scan(&views, &likes); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("stats: %w", err)
	}
	return views, likes, nil
}

func (s *Store) IncrView(slug string) (int64, error) {
	return s.incr(slug, 1, 0)
}

func (s *Store) IncrLike(slug string) (int64, error) {
	return s.incr(slug, 0, 1)
}

func (s *Store) incr(slug string, dViews, dLikes int64) (int64, error) {
	now := time.Now().Unix()
	_, err := s.db.Exec(`
		INSERT INTO counters(slug, views, likes, updated_at)
		VALUES(?, ?, ?, ?)
		ON CONFLICT(slug) DO UPDATE SET
			views      = views + excluded.views,
			likes      = likes + excluded.likes,
			updated_at = excluded.updated_at
	`, slug, dViews, dLikes, now)
	if err != nil {
		return 0, fmt.Errorf("incr: %w", err)
	}
	var v, l int64
	if err := s.db.QueryRow(`SELECT views, likes FROM counters WHERE slug = ?`, slug).Scan(&v, &l); err != nil {
		return 0, fmt.Errorf("read back: %w", err)
	}
	if dViews > 0 {
		return v, nil
	}
	return l, nil
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `cd infra/services/counter && go test -race ./... && cd -`
Expected: all 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add infra/services/counter/go.mod infra/services/counter/go.sum infra/services/counter/store.go infra/services/counter/store_test.go
git commit -m "feat(counter): SQLite store with atomic per-slug increments"
```

---

### Task 4: Counter service — rate limiter (per-IP token bucket + per-(IP,slug) dedup)

**Files:**
- Create: `infra/services/counter/ratelimit.go`
- Create: `infra/services/counter/ratelimit_test.go`

- [ ] **Step 1: Write failing tests**

Create `infra/services/counter/ratelimit_test.go`:

```go
package main

import (
	"testing"
	"time"
)

func TestTokenBucket_AllowsBurstThenRejects(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock) // 30 tokens / minute / IP

	for i := 0; i < 30; i++ {
		if !rl.AllowPost("1.2.3.4") {
			t.Fatalf("hit %d: expected allow", i+1)
		}
	}
	if rl.AllowPost("1.2.3.4") {
		t.Fatalf("31st hit must be denied")
	}
}

func TestTokenBucket_RefillsOverTime(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	for i := 0; i < 30; i++ {
		rl.AllowPost("ip")
	}
	if rl.AllowPost("ip") {
		t.Fatalf("expected denied at bucket empty")
	}
	now = now.Add(30 * time.Second) // half-refill
	if !rl.AllowPost("ip") {
		t.Fatalf("expected refill after 30s to provide at least one token")
	}
}

func TestViewDedup_BlocksRepeatWithinWindow(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	if !rl.AllowView("ip", "post-x") {
		t.Fatalf("first view must allow")
	}
	if rl.AllowView("ip", "post-x") {
		t.Fatalf("second view within window must block")
	}
	if !rl.AllowView("ip", "other-post") {
		t.Fatalf("same IP different post must allow")
	}
}

func TestViewDedup_AllowsAfterWindow(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	rl.AllowView("ip", "post-x")
	now = now.Add(31 * time.Minute)
	if !rl.AllowView("ip", "post-x") {
		t.Fatalf("view after 30min must allow again")
	}
}

func TestLikeDedup_OneShotPerIPSlug(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 100, clock)

	if !rl.AllowLike("ip", "post-x") {
		t.Fatalf("first like must allow")
	}
	if rl.AllowLike("ip", "post-x") {
		t.Fatalf("second like must block")
	}
	now = now.Add(24 * time.Hour) // even after a day
	if rl.AllowLike("ip", "post-x") {
		t.Fatalf("like dedup must persist for process lifetime")
	}
}

func TestRateLimiter_LRUEviction(t *testing.T) {
	now := time.Unix(0, 0)
	clock := func() time.Time { return now }
	rl := NewRateLimiter(30, time.Minute, 3, clock) // tiny cap

	rl.AllowPost("a")
	rl.AllowPost("b")
	rl.AllowPost("c")
	rl.AllowPost("d") // should evict "a"
	if got := rl.bucketsLen(); got > 3 {
		t.Fatalf("expected <=3 buckets after eviction, got %d", got)
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd infra/services/counter && go test -run RateLimit -race ./... && cd -`
Expected: FAIL with `undefined: NewRateLimiter`.

- [ ] **Step 3: Implement the rate limiter**

Create `infra/services/counter/ratelimit.go`:

```go
package main

import (
	"container/list"
	"sync"
	"time"
)

type bucket struct {
	tokens float64
	last   time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	capacity float64
	per      time.Duration
	maxKeys  int
	now      func() time.Time

	postBuckets map[string]*bucket
	viewSeen    map[string]time.Time // key = ip + "|" + slug
	likeSeen    map[string]struct{}  // key = ip + "|" + slug, ever

	// LRU tracking for postBuckets only (most numerous).
	lru      *list.List
	elements map[string]*list.Element
}

const viewDedupWindow = 30 * time.Minute

func NewRateLimiter(capacity int, per time.Duration, maxKeys int, now func() time.Time) *RateLimiter {
	return &RateLimiter{
		capacity:    float64(capacity),
		per:         per,
		maxKeys:     maxKeys,
		now:         now,
		postBuckets: make(map[string]*bucket),
		viewSeen:    make(map[string]time.Time),
		likeSeen:    make(map[string]struct{}),
		lru:         list.New(),
		elements:    make(map[string]*list.Element),
	}
}

// AllowPost consumes one token from the IP's bucket. Returns false when empty.
func (r *RateLimiter) AllowPost(ip string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	b := r.getBucket(ip)
	now := r.now()
	elapsed := now.Sub(b.last).Seconds()
	refill := elapsed * r.capacity / r.per.Seconds()
	b.tokens += refill
	if b.tokens > r.capacity {
		b.tokens = r.capacity
	}
	b.last = now
	if b.tokens < 1.0 {
		return false
	}
	b.tokens -= 1.0
	return true
}

// AllowView returns true if this (ip, slug) view is fresh enough to count.
func (r *RateLimiter) AllowView(ip, slug string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := ip + "|" + slug
	last, ok := r.viewSeen[key]
	now := r.now()
	if ok && now.Sub(last) < viewDedupWindow {
		return false
	}
	r.viewSeen[key] = now
	return true
}

// AllowLike returns true exactly once per (ip, slug) per process lifetime.
func (r *RateLimiter) AllowLike(ip, slug string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := ip + "|" + slug
	if _, seen := r.likeSeen[key]; seen {
		return false
	}
	r.likeSeen[key] = struct{}{}
	return true
}

// bucketsLen is for tests only.
func (r *RateLimiter) bucketsLen() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.postBuckets)
}

func (r *RateLimiter) getBucket(ip string) *bucket {
	if el, ok := r.elements[ip]; ok {
		r.lru.MoveToFront(el)
		return r.postBuckets[ip]
	}
	if r.lru.Len() >= r.maxKeys {
		oldest := r.lru.Back()
		if oldest != nil {
			oldKey := oldest.Value.(string)
			r.lru.Remove(oldest)
			delete(r.elements, oldKey)
			delete(r.postBuckets, oldKey)
		}
	}
	b := &bucket{tokens: r.capacity, last: r.now()}
	r.postBuckets[ip] = b
	r.elements[ip] = r.lru.PushFront(ip)
	return b
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd infra/services/counter && go test -race ./... && cd -`
Expected: all store + ratelimit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/services/counter/ratelimit.go infra/services/counter/ratelimit_test.go
git commit -m "feat(counter): in-memory rate limiter with view + like dedup"
```

---

### Task 5: Counter service — HTTP handlers with CORS, bot filter, slug validation

**Files:**
- Create: `infra/services/counter/handler.go`
- Create: `infra/services/counter/handler_test.go`

- [ ] **Step 1: Write failing handler tests**

Create `infra/services/counter/handler_test.go`:

```go
package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func newTestServer(t *testing.T) (*httptest.Server, *Store) {
	t.Helper()
	s, err := OpenStore(":memory:")
	if err != nil {
		t.Fatalf("OpenStore: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	clock := func() time.Time { return time.Now() }
	rl := NewRateLimiter(30, time.Minute, 1000, clock)
	mux := NewMux(s, rl)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, s
}

func do(t *testing.T, method, url string, headers map[string]string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest(method, url, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	// Default UA so bot filter doesn't drop normal-looking requests.
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "Mozilla/5.0")
	}
	if req.Header.Get("Sec-Fetch-Site") == "" {
		req.Header.Set("Sec-Fetch-Site", "same-origin")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	return resp, body
}

func TestHandler_StatsUnknownSlug(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := do(t, "GET", srv.URL+"/api/stats/never-seen", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d body=%s", resp.StatusCode, body)
	}
	var got struct{ Views, Likes int64 }
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("decode: %v body=%s", err, body)
	}
	if got.Views != 0 || got.Likes != 0 {
		t.Fatalf("got %+v want zeros", got)
	}
}

func TestHandler_ViewIncrementsThenStatsReflects(t *testing.T) {
	srv, _ := newTestServer(t)
	for i := 0; i < 3; i++ {
		// Different IPs via X-Forwarded-For to bypass view-dedup per-IP.
		_, _ = do(t, "POST", srv.URL+"/api/view/post-a", map[string]string{
			"X-Forwarded-For": ipN(i),
		})
	}
	resp, body := do(t, "GET", srv.URL+"/api/stats/post-a", nil)
	if resp.StatusCode != 200 {
		t.Fatalf("status: %d body=%s", resp.StatusCode, body)
	}
	if !strings.Contains(string(body), `"views":3`) {
		t.Fatalf("expected views:3 got %s", body)
	}
}

func TestHandler_ViewDedupSameIP(t *testing.T) {
	srv, _ := newTestServer(t)
	h := map[string]string{"X-Forwarded-For": "9.9.9.9"}
	do(t, "POST", srv.URL+"/api/view/post-x", h)
	do(t, "POST", srv.URL+"/api/view/post-x", h)
	do(t, "POST", srv.URL+"/api/view/post-x", h)
	_, body := do(t, "GET", srv.URL+"/api/stats/post-x", nil)
	if !strings.Contains(string(body), `"views":1`) {
		t.Fatalf("expected views:1 (dedup) got %s", body)
	}
}

func TestHandler_LikeDedupSameIPReturns429(t *testing.T) {
	srv, _ := newTestServer(t)
	h := map[string]string{"X-Forwarded-For": "8.8.8.8"}
	r1, _ := do(t, "POST", srv.URL+"/api/like/post-y", h)
	r2, _ := do(t, "POST", srv.URL+"/api/like/post-y", h)
	if r1.StatusCode != 200 {
		t.Fatalf("first like status %d want 200", r1.StatusCode)
	}
	if r2.StatusCode != 429 {
		t.Fatalf("second like status %d want 429", r2.StatusCode)
	}
}

func TestHandler_BotUAFilterDropsView(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := do(t, "POST", srv.URL+"/api/view/post-b", map[string]string{
		"User-Agent":      "Mozilla/5.0 (compatible; Googlebot/2.1)",
		"X-Forwarded-For": "7.7.7.7",
	})
	if resp.StatusCode != 200 {
		t.Fatalf("bot view status %d want 200 (silently dropped)", resp.StatusCode)
	}
	_, body := do(t, "GET", srv.URL+"/api/stats/post-b", nil)
	if !strings.Contains(string(body), `"views":0`) {
		t.Fatalf("expected views:0 (bot dropped) got %s", body)
	}
}

func TestHandler_BadSlugReturns400(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := do(t, "POST", srv.URL+"/api/view/..%2Fetc%2Fpasswd", nil)
	if resp.StatusCode != 400 {
		t.Fatalf("traversal slug status %d want 400", resp.StatusCode)
	}
	bigSlug := strings.Repeat("a", 250)
	resp2, _ := do(t, "POST", srv.URL+"/api/view/"+bigSlug, nil)
	if resp2.StatusCode != 400 {
		t.Fatalf("oversize slug status %d want 400", resp2.StatusCode)
	}
}

func TestHandler_CJKSlugAccepted(t *testing.T) {
	srv, _ := newTestServer(t)
	// /api/view/中文slug
	resp, _ := do(t, "POST", srv.URL+"/api/view/%E4%B8%AD%E6%96%87slug", map[string]string{
		"X-Forwarded-For": "4.4.4.4",
	})
	if resp.StatusCode != 200 {
		t.Fatalf("cjk slug status %d want 200", resp.StatusCode)
	}
}

func TestHandler_CORSHeadersOnOptions(t *testing.T) {
	srv, _ := newTestServer(t)
	req, _ := http.NewRequest("OPTIONS", srv.URL+"/api/view/x", nil)
	req.Header.Set("Origin", "https://luliu.me")
	req.Header.Set("Access-Control-Request-Method", "POST")
	resp, _ := http.DefaultClient.Do(req)
	if resp.StatusCode != 204 {
		t.Fatalf("OPTIONS status %d want 204", resp.StatusCode)
	}
	if resp.Header.Get("Access-Control-Allow-Origin") != "https://luliu.me" {
		t.Fatalf("CORS origin header: %q", resp.Header.Get("Access-Control-Allow-Origin"))
	}
}

func TestHandler_Health(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := do(t, "GET", srv.URL+"/api/_health", nil)
	if resp.StatusCode != 200 || strings.TrimSpace(string(body)) != "ok" {
		t.Fatalf("health: status=%d body=%q", resp.StatusCode, body)
	}
}

func TestHandler_StatsCacheHeader(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, _ := do(t, "GET", srv.URL+"/api/stats/anything", nil)
	if got := resp.Header.Get("Cache-Control"); got != "public, max-age=30" {
		t.Fatalf("Cache-Control: %q", got)
	}
}

func TestHandler_ConcurrentLikesFromDistinctIPs(t *testing.T) {
	srv, _ := newTestServer(t)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			do(t, "POST", srv.URL+"/api/like/concurrent-post", map[string]string{
				"X-Forwarded-For": ipN(i),
			})
		}(i)
	}
	wg.Wait()
	_, body := do(t, "GET", srv.URL+"/api/stats/concurrent-post", nil)
	if !strings.Contains(string(body), `"likes":100`) {
		t.Fatalf("want likes:100 got %s", body)
	}
}

func ipN(i int) string {
	return "10.0." + itoa(i/256) + "." + itoa(i%256)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var s string
	for i > 0 {
		s = string(rune('0'+i%10)) + s
		i /= 10
	}
	return s
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd infra/services/counter && go test -race ./... && cd -`
Expected: FAIL with `undefined: NewMux`.

- [ ] **Step 3: Implement the handler**

Create `infra/services/counter/handler.go`:

```go
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"regexp"
	"strings"
)

var (
	slugRe   = regexp.MustCompile(`^[\p{L}\p{N}_-]{1,200}$`)
	botUARe  = regexp.MustCompile(`(?i)(bot|crawler|spider|preview|wget|curl)`)
	allowedOrigin = "https://luliu.me"
)

// NewMux builds the full HTTP handler chain.
func NewMux(store *Store, rl *RateLimiter) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/_health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("GET /api/stats/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !slugRe.MatchString(slug) {
			http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
			return
		}
		views, likes, err := store.Stats(slug)
		if err != nil {
			log.Printf("stats slug=%q err=%v", slug, err)
			http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=30")
		writeJSON(w, map[string]int64{"views": views, "likes": likes})
	})
	mux.HandleFunc("POST /api/view/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !slugRe.MatchString(slug) {
			http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
			return
		}
		ip := clientIP(r)
		if !rl.AllowPost(ip) {
			http.Error(w, `{"error":"rate limit"}`, http.StatusTooManyRequests)
			return
		}
		if isBot(r) || !rl.AllowView(ip, slug) {
			// Silently no-op: return current value, status 200.
			views, _, _ := store.Stats(slug)
			writeJSON(w, map[string]int64{"views": views})
			return
		}
		views, err := store.IncrView(slug)
		if err != nil {
			log.Printf("incrview slug=%q err=%v", slug, err)
			http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]int64{"views": views})
	})
	mux.HandleFunc("POST /api/like/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !slugRe.MatchString(slug) {
			http.Error(w, `{"error":"bad slug"}`, http.StatusBadRequest)
			return
		}
		ip := clientIP(r)
		if !rl.AllowPost(ip) {
			http.Error(w, `{"error":"rate limit"}`, http.StatusTooManyRequests)
			return
		}
		if !rl.AllowLike(ip, slug) {
			http.Error(w, `{"error":"already liked"}`, http.StatusTooManyRequests)
			return
		}
		likes, err := store.IncrLike(slug)
		if err != nil {
			log.Printf("incrlike slug=%q err=%v", slug, err)
			http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]int64{"likes": likes})
	})
	return cors(recoverer(mux))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if p := recover(); p != nil {
				log.Printf("panic: %v path=%s", p, r.URL.Path)
				if !errors.Is(r.Context().Err(), nil) {
					return
				}
				http.Error(w, `{"error":"server"}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

// clientIP trusts X-Forwarded-For from Caddy (single hop on loopback).
// In production traffic passes Caddy -> 127.0.0.1:8787, so X-F-F is set by Caddy.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// First entry is the originator.
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func isBot(r *http.Request) bool {
	ua := r.Header.Get("User-Agent")
	if botUARe.MatchString(ua) {
		return true
	}
	// Naïve scrapers often miss Sec-Fetch-Site AND don't claim Mozilla.
	if r.Header.Get("Sec-Fetch-Site") == "" && !strings.Contains(ua, "Mozilla/") {
		return true
	}
	return false
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd infra/services/counter && go test -race ./... && cd -`
Expected: all tests PASS (store + ratelimit + handler).

- [ ] **Step 5: Commit**

```bash
git add infra/services/counter/handler.go infra/services/counter/handler_test.go
git commit -m "feat(counter): HTTP handlers with CORS, bot filter, slug validation"
```

---

### Task 6: Counter service — main entrypoint + systemd unit

**Files:**
- Create: `infra/services/counter/main.go`
- Create: `infra/services/counter/counter.service`

- [ ] **Step 1: Write main.go**

Create `infra/services/counter/main.go`:

```go
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	addr := os.Getenv("COUNTER_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8787"
	}
	dsn := os.Getenv("COUNTER_DB")
	if dsn == "" {
		dsn = "counter.db"
	}

	store, err := OpenStore(dsn)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer store.Close()

	rl := NewRateLimiter(30, time.Minute, 10_000, time.Now)
	mux := NewMux(store, rl)

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadTimeout:       5 * time.Second,
		ReadHeaderTimeout: 3 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		log.Printf("counter listening on %s db=%s", addr, dsn)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	log.Print("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
```

- [ ] **Step 2: Verify the binary builds**

Run: `cd infra/services/counter && go build -o /tmp/counter-test . && rm /tmp/counter-test && cd -`
Expected: build succeeds, no output.

- [ ] **Step 3: Quick smoke test (manual, optional)**

Run:
```bash
cd infra/services/counter
COUNTER_DB=/tmp/counter-smoke.db COUNTER_ADDR=127.0.0.1:18787 go run . &
PID=$!
sleep 1
curl -s http://127.0.0.1:18787/api/_health
echo
curl -s http://127.0.0.1:18787/api/stats/test
echo
curl -s -X POST http://127.0.0.1:18787/api/view/test \
  -H 'User-Agent: Mozilla/5.0' -H 'Sec-Fetch-Site: same-origin' \
  -H 'X-Forwarded-For: 1.2.3.4'
echo
kill $PID
rm -f /tmp/counter-smoke.db
cd -
```
Expected: `ok` / `{"views":0,"likes":0}` / `{"views":1}`.

- [ ] **Step 4: Write systemd unit**

Create `infra/services/counter/counter.service`:

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

- [ ] **Step 5: Commit**

```bash
git add infra/services/counter/main.go infra/services/counter/counter.service
git commit -m "feat(counter): main entrypoint + systemd unit"
```

---

### Task 7: PostEngagement Astro component (UI shell, no JS yet)

**Files:**
- Create: `src/components/PostEngagement.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add styles for the engagement block**

Append to `src/styles/global.css`:

```css
/* Post engagement (word count, views, like, share) */
.engagement {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px solid var(--rule);
  font-family: var(--sans);
  font-size: 0.9rem;
  color: var(--muted);
}
.engagement .stats { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.engagement .actions { display: flex; gap: var(--space-1); }
.engagement button {
  font: inherit;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  cursor: pointer;
  min-height: 32px;
  transition: color 120ms, border-color 120ms;
}
.engagement button:hover { color: var(--fg); border-color: var(--muted); }
.engagement button[aria-pressed="true"] {
  color: var(--accent);
  border-color: var(--accent);
  cursor: default;
}
.engagement .toast {
  position: fixed;
  bottom: 1.2rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--fg);
  color: var(--bg);
  padding: 0.5rem 0.9rem;
  border-radius: 4px;
  font-size: 0.88rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms;
}
.engagement .toast.show { opacity: 0.92; }
```

- [ ] **Step 2: Create the component**

Create `src/components/PostEngagement.astro`:

```astro
---
interface Props {
  slug: string;
  words: number;
}
const { slug, words } = Astro.props;
---
<aside class="engagement" data-slug={slug}>
  <div class="stats">
    <span class="views" aria-label="阅读次数">— 次阅读</span>
    <span class="words">{words.toLocaleString()} 字</span>
  </div>
  <div class="actions">
    <button class="like-btn" aria-pressed="false" type="button">
      <span aria-hidden="true">♡</span> <span class="count">—</span>
    </button>
    <button class="share-btn" type="button">分享</button>
  </div>
  <div class="toast" aria-live="polite"></div>
</aside>
<script src="../scripts/engagement.ts"></script>
```

- [ ] **Step 3: Wire it into the post template**

Modify `src/pages/posts/[...slug].astro` to import + use the component, and pass `words`:

```astro
---
import { type CollectionEntry, getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostEngagement from '../../components/PostEngagement.astro';
import { readingStats } from '../../lib/reading-stats';

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
const { words, minutes } = readingStats(post.body ?? '');
const slug = post.data.slug ?? post.id;

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
---
<BaseLayout title={`${post.data.title} — luliu.me`}>
  <article>
    <h1>{post.data.title}</h1>
    <p class="post-meta">
      <span>{fmt(post.data.date)}</span>
      <span> · 约 {minutes} 分钟读完</span>
      {post.data.tags.length > 0 && <span> · </span>}
      {post.data.tags.map((t) => <span class="tag">{t}</span>)}
      {post.data.source === 'cnblogs' && post.data.sourceUrl && (
        <span> · <a href={post.data.sourceUrl}>原文 (cnblogs)</a></span>
      )}
    </p>
    <Content />
    <PostEngagement slug={slug} words={words} />
  </article>
</BaseLayout>
```

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Verify HTML output**

Run:
```bash
grep -o 'class="engagement"' dist/posts/why-not-wechat/index.html
grep -oE '[0-9,]+ 字' dist/posts/why-not-wechat/index.html
```
Expected: matches found.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostEngagement.astro src/pages/posts/\[...slug\].astro src/styles/global.css
git commit -m "feat(posts): PostEngagement component (UI shell, word count visible)"
```

---

### Task 8: Engagement client script (fetch stats, fire view, handle like + share)

**Files:**
- Create: `src/scripts/engagement.ts`
- Create: `src/scripts/engagement.test.ts`
- Modify: `vitest.config.ts` (enable jsdom for these tests)
- Modify: `package.json` (add `jsdom` devDep)

- [ ] **Step 1: Add jsdom + configure Vitest**

Run: `pnpm add -D jsdom`

Modify `vitest.config.ts` to switch environment per-file via a glob — replace it with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts'],
    environmentMatchGlobs: [
      ['src/scripts/**/*.test.ts', 'jsdom'],
    ],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write failing tests**

Create `src/scripts/engagement.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wireEngagement } from './engagement';

function mountDom(slug = 'test-slug') {
  document.body.innerHTML = `
    <aside class="engagement" data-slug="${slug}">
      <div class="stats">
        <span class="views">— 次阅读</span>
        <span class="words">100 字</span>
      </div>
      <div class="actions">
        <button class="like-btn" aria-pressed="false" type="button">
          <span aria-hidden="true">♡</span> <span class="count">—</span>
        </button>
        <button class="share-btn" type="button">分享</button>
      </div>
      <div class="toast" aria-live="polite"></div>
    </aside>
  `;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('wireEngagement', () => {
  it('hydrates stats and fires one view increment', async () => {
    mountDom();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ views: 7, likes: 3 })) // GET stats
      .mockResolvedValueOnce(jsonResp({ views: 8 }));          // POST view
    await wireEngagement({ fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/stats\/test-slug$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/view\/test-slug$/);
    expect(document.querySelector('.views')!.textContent).toContain('8');
    expect(document.querySelector('.like-btn .count')!.textContent).toBe('3');
  });

  it('keeps stats unchanged when API unreachable', async () => {
    mountDom();
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    await wireEngagement({ fetch: fetchMock });
    expect(document.querySelector('.views')!.textContent).toContain('—');
  });

  it('disables like button when localStorage flag is set', async () => {
    localStorage.setItem('liked:test-slug', '1');
    mountDom();
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ views: 0, likes: 5 }));
    await wireEngagement({ fetch: fetchMock });
    const btn = document.querySelector<HTMLButtonElement>('.like-btn')!;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('like click persists to localStorage on 2xx', async () => {
    mountDom();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ views: 0, likes: 0 })) // GET stats
      .mockResolvedValueOnce(jsonResp({ views: 1 }))           // POST view
      .mockResolvedValueOnce(jsonResp({ likes: 1 }));          // POST like
    await wireEngagement({ fetch: fetchMock });
    const btn = document.querySelector<HTMLButtonElement>('.like-btn')!;
    btn.click();
    await flush();
    expect(localStorage.getItem('liked:test-slug')).toBe('1');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.like-btn .count')!.textContent).toBe('1');
  });

  it('reverts like state on 5xx', async () => {
    mountDom();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ views: 0, likes: 0 }))
      .mockResolvedValueOnce(jsonResp({ views: 1 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    await wireEngagement({ fetch: fetchMock });
    document.querySelector<HTMLButtonElement>('.like-btn')!.click();
    await flush();
    expect(localStorage.getItem('liked:test-slug')).toBeNull();
    expect(
      document.querySelector<HTMLButtonElement>('.like-btn')!.getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('share uses navigator.share when present', async () => {
    mountDom();
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ views: 0, likes: 0 }));
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareSpy, configurable: true });
    await wireEngagement({ fetch: fetchMock });
    document.querySelector<HTMLButtonElement>('.share-btn')!.click();
    await flush();
    expect(shareSpy).toHaveBeenCalled();
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  it('share falls back to clipboard when navigator.share missing', async () => {
    mountDom();
    const fetchMock = vi.fn().mockResolvedValue(jsonResp({ views: 0, likes: 0 }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await wireEngagement({ fetch: fetchMock });
    document.querySelector<HTMLButtonElement>('.share-btn')!.click();
    await flush();
    expect(writeText).toHaveBeenCalledWith(location.href);
  });
});

function jsonResp(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test src/scripts/engagement.test.ts --run`
Expected: FAIL with `Cannot find module './engagement'`.

- [ ] **Step 4: Implement the client script**

Create `src/scripts/engagement.ts`:

```ts
// Wires up the .engagement block on each post page:
// - Fetches stats + fires a single view increment on load.
// - Handles Like clicks with localStorage dedup + optimistic UI.
// - Handles Share via navigator.share() with clipboard fallback.
//
// Module-level entry point at end runs automatically once DOM is ready.
// Exported wireEngagement(deps) is used in unit tests with a mocked fetch.

interface Deps {
  fetch: typeof fetch;
}

export async function wireEngagement(deps: Deps): Promise<void> {
  const root = document.querySelector<HTMLElement>('.engagement');
  if (!root) return;
  const slug = root.dataset.slug;
  if (!slug) return;

  const viewsEl = root.querySelector<HTMLElement>('.views')!;
  const likeBtn = root.querySelector<HTMLButtonElement>('.like-btn')!;
  const likeCount = root.querySelector<HTMLElement>('.like-btn .count')!;
  const shareBtn = root.querySelector<HTMLButtonElement>('.share-btn')!;
  const toast = root.querySelector<HTMLElement>('.toast')!;

  const alreadyLiked = readLikedFlag(slug);
  if (alreadyLiked) {
    likeBtn.setAttribute('aria-pressed', 'true');
  }

  // Hydrate from /api/stats then fire view.
  try {
    const r = await deps.fetch(`/api/stats/${encodeURIComponent(slug)}`);
    if (r.ok) {
      const { views, likes } = await r.json();
      renderViews(viewsEl, views);
      renderLikes(likeCount, likes);
    }
  } catch (err) {
    console.warn('stats fetch failed', err);
  }

  try {
    const r = await deps.fetch(`/api/view/${encodeURIComponent(slug)}`, { method: 'POST' });
    if (r.ok) {
      const { views } = await r.json();
      if (typeof views === 'number') renderViews(viewsEl, views);
    }
  } catch (err) {
    console.warn('view post failed', err);
  }

  likeBtn.addEventListener('click', async () => {
    if (likeBtn.getAttribute('aria-pressed') === 'true') return;
    const prevCount = parseLikeCount(likeCount.textContent);
    likeBtn.setAttribute('aria-pressed', 'true');
    likeCount.textContent = String(prevCount + 1);
    writeLikedFlag(slug);
    try {
      const r = await deps.fetch(`/api/like/${encodeURIComponent(slug)}`, { method: 'POST' });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const { likes } = await r.json();
      if (typeof likes === 'number') renderLikes(likeCount, likes);
    } catch (err) {
      console.warn('like post failed', err);
      likeBtn.setAttribute('aria-pressed', 'false');
      likeCount.textContent = String(prevCount);
      clearLikedFlag(slug);
      showToast(toast, '稍后再试');
    }
  });

  shareBtn.addEventListener('click', async () => {
    const url = location.href;
    const title = document.title;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // user cancellation throws AbortError; treat as no-op
        if ((err as Error)?.name !== 'AbortError') console.warn('share failed', err);
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(toast, '已复制链接');
    } catch (err) {
      console.warn('clipboard failed', err);
    }
  });
}

function renderViews(el: HTMLElement, n: number): void {
  el.textContent = `${n.toLocaleString()} 次阅读`;
}
function renderLikes(el: HTMLElement, n: number): void {
  el.textContent = String(n);
}
function parseLikeCount(text: string | null): number {
  const n = parseInt((text ?? '0').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function readLikedFlag(slug: string): boolean {
  try {
    return localStorage.getItem(`liked:${slug}`) === '1';
  } catch {
    return false;
  }
}
function writeLikedFlag(slug: string): void {
  try {
    localStorage.setItem(`liked:${slug}`, '1');
  } catch {
    /* private mode etc. — server dedup absorbs */
  }
}
function clearLikedFlag(slug: string): void {
  try {
    localStorage.removeItem(`liked:${slug}`);
  } catch {
    /* ignore */
  }
}
function showToast(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

// Auto-run on the live page only.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const start = () => wireEngagement({ fetch: window.fetch.bind(window) });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm test src/scripts/engagement.test.ts --run`
Expected: all 7 tests PASS.

- [ ] **Step 6: Run the full test suite**

Run: `pnpm test --run`
Expected: all tests pass (reading-stats + engagement + any pre-existing tests).

- [ ] **Step 7: Build and verify bundling**

Run: `pnpm build && grep -l 'liked:' dist/_astro/*.js | head -3`
Expected: at least one bundled JS file contains the `liked:` string — proves Vite picked up the relative import.

- [ ] **Step 8: Commit**

```bash
git add src/scripts/engagement.ts src/scripts/engagement.test.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "feat(engagement): client script (stats hydrate, view fire, like, share)"
```

---

### Task 9: Caddyfile + vm-bootstrap.sh extensions

**Files:**
- Modify: `infra/Caddyfile`
- Modify: `infra/vm-bootstrap.sh`

- [ ] **Step 1: Add `/api/*` reverse-proxy block to Caddyfile**

Replace `infra/Caddyfile` with:

```
luliu.me {
    root * /var/www/luliu.me
    encode gzip zstd

    # Counter API (reverse-proxied to local Go service).
    handle /api/* {
        reverse_proxy localhost:8787
        request_body { max_size 1KB }
    }

    # Legacy /blog and /blog/* (Hexo prefix) → root
    redir /blog /  permanent
    redir /blog/* / permanent

    file_server

    # Real 404s (path not found by file_server) → /404.html
    handle_errors {
        @404 expression `{http.error.status_code} == 404`
        handle @404 {
            rewrite * /404.html
            file_server
        }
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Cache-Control "public, max-age=3600"
    }
    header /_astro/* Cache-Control "public, max-age=31536000, immutable"
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
    header /api/* Cache-Control "no-store"
}

# www → apex (canonical)
www.luliu.me {
    redir https://luliu.me{uri} permanent
}
```

- [ ] **Step 2: Extend vm-bootstrap.sh**

Append to `infra/vm-bootstrap.sh` (just before the final `echo "==> Bootstrap done."`):

```bash
echo "==> Counter service user + state directory"
if ! id counter >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/counter --shell /usr/sbin/nologin counter
fi
install -d -o counter -g counter -m 0750 /var/lib/counter
install -d -o root    -g root    -m 0755 /opt/counter

echo "==> Counter sudo for deploy (restart only)"
cat > /etc/sudoers.d/deploy-counter <<'SUDO'
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart counter, /bin/systemctl daemon-reload
SUDO
chmod 440 /etc/sudoers.d/deploy-counter
visudo -c -f /etc/sudoers.d/deploy-counter

echo "==> Counter systemd unit (placeholder until first CI deploy)"
if [ ! -f /etc/systemd/system/counter.service ]; then
  cat > /etc/systemd/system/counter.service <<'UNIT'
[Unit]
Description=luliu.me engagement counter service (placeholder)
After=network.target

[Service]
Type=simple
User=counter
Group=counter
ExecStart=/opt/counter/counter
Restart=on-failure
RestartSec=2s
Environment=COUNTER_DB=/var/lib/counter/counter.db
Environment=COUNTER_ADDR=127.0.0.1:8787

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/counter

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
fi
# Don't start yet — the binary lands via the first CI deploy.
systemctl enable counter || true

echo "==> Counter backup systemd timer"
cat > /etc/systemd/system/counter-backup.service <<'UNIT'
[Unit]
Description=Snapshot counter.db (online .backup)
After=counter.service

[Service]
Type=oneshot
User=counter
Group=counter
ExecStart=/usr/bin/sqlite3 /var/lib/counter/counter.db ".backup '/var/lib/counter/counter.db.bak'"
UNIT
cat > /etc/systemd/system/counter-backup.timer <<'UNIT'
[Unit]
Description=Daily counter.db snapshot

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
UNIT
# sqlite3 CLI for .backup
DEBIAN_FRONTEND=noninteractive apt-get -y install sqlite3
systemctl daemon-reload
systemctl enable --now counter-backup.timer
```

- [ ] **Step 3: Validate Caddyfile syntax locally (if caddy installed) — optional**

Run (skip if no `caddy` locally): `caddy fmt --overwrite infra/Caddyfile && git diff infra/Caddyfile`
Expected: no diff or only whitespace fixes.

- [ ] **Step 4: Commit**

```bash
git add infra/Caddyfile infra/vm-bootstrap.sh
git commit -m "infra(counter): Caddy /api/* reverse-proxy + VM bootstrap additions"
```

---

### Task 10: CI counter-deploy workflow

**Files:**
- Create: `.github/workflows/counter-deploy.yml`

The existing `deploy.yml` excludes `infra/**` from triggering, so this gets its own workflow keyed to counter-service paths.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/counter-deploy.yml`:

```yaml
name: counter-deploy
on:
  push:
    branches: [master]
    paths:
      - 'infra/services/counter/**'
      - 'infra/Caddyfile'
      - '.github/workflows/counter-deploy.yml'

concurrency:
  group: counter-deploy-prod
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 1

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
          cache-dependency-path: infra/services/counter/go.sum

      - name: Test counter service
        working-directory: infra/services/counter
        run: go test -race ./...

      - name: Build counter binary (linux/amd64)
        working-directory: infra/services/counter
        env:
          GOOS: linux
          GOARCH: amd64
          CGO_ENABLED: '0'
        run: go build -trimpath -ldflags='-s -w' -o counter .

      - name: Setup SSH
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.VM_HOST }}" >> ~/.ssh/known_hosts

      - name: Rsync binary + unit + Caddyfile
        run: |
          rsync -az infra/services/counter/counter \
            "deploy@${{ secrets.VM_HOST }}:/tmp/counter"
          rsync -az infra/services/counter/counter.service \
            "deploy@${{ secrets.VM_HOST }}:/tmp/counter.service"
          rsync -az infra/Caddyfile \
            "deploy@${{ secrets.VM_HOST }}:/tmp/Caddyfile"

      - name: Install + restart counter, reload Caddy
        env:
          VM_HOST: ${{ secrets.VM_HOST }}
        run: |
          ssh "deploy@$VM_HOST" bash -s <<'REMOTE'
          set -euo pipefail
          sudo install -m 0755 -o root -g root /tmp/counter /opt/counter/counter
          sudo install -m 0644 -o root -g root /tmp/counter.service /etc/systemd/system/counter.service
          sudo install -m 0644 -o root -g root /tmp/Caddyfile /etc/caddy/Caddyfile
          rm -f /tmp/counter /tmp/counter.service /tmp/Caddyfile
          sudo /bin/systemctl daemon-reload
          sudo /bin/systemctl restart counter
          sudo /bin/systemctl reload caddy
          REMOTE

      - name: Healthcheck
        run: |
          for i in 1 2 3 4 5 6 7 8 9 10; do
            if curl -fsS https://luliu.me/api/_health | grep -q '^ok'; then
              echo "healthcheck ok on attempt $i"
              exit 0
            fi
            sleep 3
          done
          echo "healthcheck FAILED"
          exit 1
```

- [ ] **Step 2: Add a sudo rule for installs (extend vm-bootstrap.sh)**

The previous bootstrap added `systemctl restart counter` + `daemon-reload`. The `ssh` block above also runs `install`, `caddy reload`, and reads `/tmp` files. `caddy reload` is already in the existing deploy sudoers entry. `install` needs root but is a single safe command we can permit narrowly.

Append to `infra/vm-bootstrap.sh` (just under the existing `deploy-counter` sudoers block):

```bash
echo "==> Counter file-install sudo for deploy"
cat > /etc/sudoers.d/deploy-counter-install <<'SUDO'
deploy ALL=(ALL) NOPASSWD: /usr/bin/install -m 0755 -o root -g root /tmp/counter /opt/counter/counter, /usr/bin/install -m 0644 -o root -g root /tmp/counter.service /etc/systemd/system/counter.service, /usr/bin/install -m 0644 -o root -g root /tmp/Caddyfile /etc/caddy/Caddyfile
SUDO
chmod 440 /etc/sudoers.d/deploy-counter-install
visudo -c -f /etc/sudoers.d/deploy-counter-install
```

- [ ] **Step 3: Verify locally that the workflow YAML parses**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/counter-deploy.yml'))" && echo ok`
Expected: `ok`.

- [ ] **Step 4: Commit (no deploy yet)**

```bash
git add .github/workflows/counter-deploy.yml infra/vm-bootstrap.sh
git commit -m "ci(counter): deploy workflow (build, rsync, restart, healthcheck)"
```

---

### Task 11: CI nightly counter-backup workflow

**Files:**
- Create: `.github/workflows/counter-backup.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/counter-backup.yml`:

```yaml
name: counter-backup
on:
  schedule:
    - cron: '0 3 * * *'   # 03:00 UTC daily
  workflow_dispatch: {}

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Setup SSH
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.VM_HOST }}" >> ~/.ssh/known_hosts

      - name: Rsync counter.db.bak from VM
        run: |
          mkdir -p backup
          rsync -az \
            "deploy@${{ secrets.VM_HOST }}:/var/lib/counter/counter.db.bak" \
            backup/counter.db.bak || {
              echo "no snapshot yet, falling back to live DB"
              rsync -az \
                "deploy@${{ secrets.VM_HOST }}:/var/lib/counter/counter.db" \
                backup/counter.db
            }
          ls -lh backup/

      - uses: actions/upload-artifact@v4
        with:
          name: counter-db-${{ github.run_id }}
          path: backup/
          retention-days: 90
```

- [ ] **Step 2: Allow `deploy` to read `counter.db.bak`**

The `counter` user owns the snapshot file with mode 0640 (from `.backup` defaults). To let `deploy` rsync it, add `deploy` to the `counter` group.

Append to `infra/vm-bootstrap.sh` (after the `counter` useradd block):

```bash
echo "==> Allow deploy to read counter snapshots"
usermod -aG counter deploy
# Snapshot file needs to be group-readable. Re-applied by the systemd backup
# unit each run, but normalise existing files:
[ -f /var/lib/counter/counter.db.bak ] && chmod 0640 /var/lib/counter/counter.db.bak || true
chmod 0750 /var/lib/counter
```

- [ ] **Step 3: Verify workflow YAML parses**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/counter-backup.yml'))" && echo ok`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/counter-backup.yml infra/vm-bootstrap.sh
git commit -m "ci(counter): nightly SQLite backup via rsync to workflow artifact"
```

---

### Task 12: Update authoring workflow doc

**Files:**
- Modify: `docs/obsidian-workflow.md`

- [ ] **Step 1: Append a Counter service section**

Add a new section near the end of `docs/obsidian-workflow.md`, right before `## Cheatsheet`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/obsidian-workflow.md
git commit -m "docs(workflow): document counter service in authoring guide"
```

---

### Task 13: Post-deploy smoke checklist + push everything

**Files:**
- Create: `docs/superpowers/runbooks/counter-deploy-smoke.md`

- [ ] **Step 1: Write the smoke runbook**

Create `docs/superpowers/runbooks/counter-deploy-smoke.md`:

```markdown
# Counter Deploy — Manual Smoke Checklist

Run after the first push that lands the counter (and after the one-time
VM bootstrap from `infra/vm-bootstrap.sh`).

## On the VM (single SSH session)

```bash
sudo bash /root/vm-bootstrap.sh   # idempotent; re-run picks up counter additions
systemctl status counter --no-pager | head -10
systemctl status counter-backup.timer --no-pager | head -5
ls -la /var/lib/counter/
```

Expected:
- `counter.service` active (after first CI deploy)
- `counter-backup.timer` enabled + active
- `/var/lib/counter/counter.db` (and later `.db.bak`) present, owned by `counter:counter`.

## From any browser / curl

```bash
curl -fsS https://luliu.me/api/_health
# → ok

curl -fsS https://luliu.me/api/stats/why-not-wechat
# → {"views":0,"likes":0}   (or higher if visits already counted)

curl -fsS -X POST https://luliu.me/api/view/why-not-wechat \
  -H 'User-Agent: Mozilla/5.0' -H 'Sec-Fetch-Site: same-origin'
# → {"views":N}

# Repeat from same IP within 30 min → no change.
```

## In a real browser

1. Open https://luliu.me/posts/why-not-wechat/.
2. Confirm engagement block at bottom shows:
   - `N 次阅读` (number, not `—`).
   - Word count (`字`).
   - Like button + Share button.
3. Click Like → button turns highlighted; refresh → still highlighted (localStorage).
4. Click Share:
   - Android Chrome → OS share sheet appears.
   - Desktop browser → toast `已复制链接` and clipboard contains the URL.
5. DevTools → Application → Local Storage: `liked:why-not-wechat = "1"`.

## Failure modes to spot

- API `/api/_health` returns 502 → counter service down. `journalctl -u counter -n 50`.
- Engagement shows persistent `—` → check CORS in DevTools Network tab; verify `Access-Control-Allow-Origin: https://luliu.me`.
- Like 429 on first click → check rate limiter sees correct client IP (Caddy forwarding `X-Forwarded-For`?).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/counter-deploy-smoke.md
git commit -m "docs(runbook): counter deploy smoke checklist"
```

- [ ] **Step 3: Push everything**

Run: `git push`
Expected:
- Pre-push hook runs `pnpm build` + smoke check + passes.
- Two CI workflows trigger on master:
  - `deploy` (existing static site) — likely no-op for content (only minor `[...slug].astro` change forces a rebuild; that's fine).
  - `counter-deploy` (new) — builds Go binary, ships it, restarts counter, healthchecks.
- `counter-backup` workflow shows up in Actions tab on its daily schedule.

- [ ] **Step 4: Watch deploys**

Run:
```bash
gh run watch --exit-status   # follow the first triggered run
```
Expected: both workflows green.

- [ ] **Step 5: Run smoke checklist**

Open `docs/superpowers/runbooks/counter-deploy-smoke.md` and walk through it.

---

## Done

All 4 engagement features live on `/posts/<slug>/`:
1. Reading time chip in post-meta.
2. Word count in engagement block.
3. Like button (anonymous +1, localStorage dedup).
4. Share button (`navigator.share` → clipboard fallback).
5. View counter (server-side increment).

Operations: one extra systemd unit (`counter.service`), one SQLite file with daily snapshot, one CI workflow per deploy + one per backup.
