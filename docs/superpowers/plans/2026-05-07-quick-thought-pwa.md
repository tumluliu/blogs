# Quick-Thought PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a single-page PWA at `/q-sort/` that captures a new thought and publishes it to this repo via the GitHub Contents API; auto-deploy then makes it visible on https://luliu.me/ within ~2 min.

**Architecture:** A static Astro page hosts a textarea + Publish button. Pure-logic helpers (filename, frontmatter, base64) live in `src/lib/q-sort/` and are unit-tested with Vitest. A thin GitHub API wrapper PUTs to `/repos/tumluliu/blogs/contents/src/content/thoughts/<filename>` using a fine-grained PAT stored in `localStorage`. A `manifest.webmanifest` + service worker make the page installable and offline-shell-cacheable. The route is `noindex` + `robots.txt`-disallowed.

**Tech Stack:** Astro 6, TypeScript, Vitest, sharp (icon generation), GitHub Contents API.

**Source spec:** [`docs/superpowers/specs/2026-05-07-quick-thought-pwa-design.md`](../specs/2026-05-07-quick-thought-pwa-design.md)
**Tracking issue:** https://github.com/tumluliu/blogs/issues/1

---

## File Structure

| Path | Responsibility | New / Mod |
|------|---------------|-----------|
| `src/lib/q-sort/builders.ts` | Pure functions: `buildFilename`, `buildFrontmatter`, `buildMarkdown`, `utf8Base64` | New |
| `src/lib/q-sort/builders.test.ts` | Vitest unit tests for builders (incl. CJK round-trip) | New |
| `src/lib/q-sort/api.ts` | `publishThought(deps, body)` — calls GitHub Contents API with `fetch`, returns `{ok, status, message}` | New |
| `src/lib/q-sort/api.test.ts` | Vitest tests for `publishThought` with mocked `fetch` | New |
| `src/lib/q-sort/storage.ts` | Thin wrappers `loadConfig() / saveConfig() / clearConfig()` for `localStorage` keys `qsort.pat` and `qsort.repo` | New |
| `src/pages/q-sort/index.astro` | Page + UI + glue (textarea, Publish button, status line, settings modal, SW registration) | New |
| `public/manifest.webmanifest` | PWA manifest (name, icons, `start_url: /q-sort/`, `display: standalone`, theme color) | New |
| `public/sw.js` | Service worker; cache-first for shell, network-only for `api.github.com` | New |
| `public/icons/q-sort-192.png` | PWA icon, 192×192, generated via sharp from inline SVG | New |
| `public/icons/q-sort-512.png` | PWA icon, 512×512, generated via sharp from inline SVG | New |
| `scripts/q-sort/make-icons.ts` | One-shot icon generator (kept for regeneration / future tweaks) | New |
| `public/robots.txt` | Add `Disallow: /q-sort/` | New (file does not exist yet — verify in Task 7) |
| `vitest.config.ts` | Broaden `include` to also match `src/**/*.test.ts` | Modify |

---

## Task 1: Broaden Vitest config to cover `src/**`

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Read current Vitest config**

```bash
cat vitest.config.ts
```

Current content:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Add `src/**/*.test.ts` to the include list**

Replace the file contents with:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm test --run`
Expected: all existing `scripts/lib/*.test.ts` tests PASS, no new failures.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts
git commit -m "chore(test): include src/**/*.test.ts in vitest"
```

---

## Task 2: `buildFilename` — date → `YYYY-MM-DD-HHmm.md`

**Files:**
- Create: `src/lib/q-sort/builders.ts`
- Create: `src/lib/q-sort/builders.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/q-sort/builders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFilename } from './builders.js';

describe('buildFilename', () => {
  it('formats a date as YYYY-MM-DD-HHmm.md in local time', () => {
    // 2026-05-07 09:07 local
    const d = new Date(2026, 4, 7, 9, 7, 33);
    expect(buildFilename(d)).toBe('2026-05-07-0907.md');
  });

  it('zero-pads single-digit month, day, hour, minute', () => {
    const d = new Date(2026, 0, 1, 0, 0, 0);
    expect(buildFilename(d)).toBe('2026-01-01-0000.md');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test --run src/lib/q-sort/builders.test.ts`
Expected: FAIL with `Cannot find module './builders.js'` or similar.

- [ ] **Step 3: Implement `buildFilename`**

Create `src/lib/q-sort/builders.ts`:

```ts
const pad = (n: number) => n.toString().padStart(2, '0');

export function buildFilename(now: Date): string {
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  return `${y}-${m}-${d}-${hh}${mm}.md`;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm test --run src/lib/q-sort/builders.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/q-sort/builders.ts src/lib/q-sort/builders.test.ts
git commit -m "feat(q-sort): add buildFilename helper"
```

---

## Task 3: `buildFrontmatter` and `buildMarkdown`

**Files:**
- Modify: `src/lib/q-sort/builders.ts`
- Modify: `src/lib/q-sort/builders.test.ts`

- [ ] **Step 1: Add failing tests for frontmatter + markdown**

Append to `src/lib/q-sort/builders.test.ts`:

```ts
import { buildFrontmatter, buildMarkdown } from './builders.js';

describe('buildFrontmatter', () => {
  it('emits ISO 8601 with timezone offset and an empty tags array', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const fm = buildFrontmatter(d);
    expect(fm).toContain('date: 2026-05-07T09:07:33+0200');
    expect(fm).toContain('tags: []');
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('---\n')).toBe(true);
  });
});

describe('buildMarkdown', () => {
  it('joins frontmatter and body with a single blank line', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const md = buildMarkdown(d, 'hello, world');
    expect(md).toMatch(/^---\ndate: 2026-05-07T09:07:33\+0200\ntags: \[\]\n---\n\nhello, world\n$/);
  });

  it('preserves trailing newline and trims trailing whitespace from body', () => {
    const d = new Date('2026-05-07T09:07:33+02:00');
    const md = buildMarkdown(d, '  some thought   \n  \n');
    expect(md.endsWith('  some thought\n')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test --run src/lib/q-sort/builders.test.ts`
Expected: 4 PASS (existing) + 3 FAIL on new.

- [ ] **Step 3: Implement `buildFrontmatter` and `buildMarkdown`**

Append to `src/lib/q-sort/builders.ts`:

```ts
function isoWithOffset(d: Date): string {
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const tzAbs = Math.abs(tzMin);
  const tzH = pad(Math.floor(tzAbs / 60));
  const tzM = pad(tzAbs % 60);
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const da = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${mo}-${da}T${hh}:${mm}:${ss}${sign}${tzH}${tzM}`;
}

export function buildFrontmatter(now: Date): string {
  return `---\ndate: ${isoWithOffset(now)}\ntags: []\n---\n`;
}

export function buildMarkdown(now: Date, body: string): string {
  const trimmed = body.replace(/\s+$/u, '');
  return `${buildFrontmatter(now)}\n${trimmed}\n`;
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm test --run src/lib/q-sort/builders.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/q-sort/builders.ts src/lib/q-sort/builders.test.ts
git commit -m "feat(q-sort): add buildFrontmatter and buildMarkdown helpers"
```

---

## Task 4: `utf8Base64` — UTF-8-safe base64 (CJK round-trip)

**Files:**
- Modify: `src/lib/q-sort/builders.ts`
- Modify: `src/lib/q-sort/builders.test.ts`

- [ ] **Step 1: Add failing test for `utf8Base64`**

Append to `src/lib/q-sort/builders.test.ts`:

```ts
import { utf8Base64 } from './builders.js';

describe('utf8Base64', () => {
  it('round-trips ASCII', () => {
    const s = 'hello, world';
    const b64 = utf8Base64(s);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    expect(decoded).toBe(s);
  });

  it('round-trips CJK (UTF-8)', () => {
    const s = '试试看能不能发出来';
    const b64 = utf8Base64(s);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    expect(decoded).toBe(s);
  });

  it('round-trips emoji + mixed scripts', () => {
    const s = 'café — 你好 🌧';
    const b64 = utf8Base64(s);
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    expect(decoded).toBe(s);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `pnpm test --run src/lib/q-sort/builders.test.ts`
Expected: existing PASS, 3 FAIL on `utf8Base64` (not exported).

- [ ] **Step 3: Implement `utf8Base64`**

Append to `src/lib/q-sort/builders.ts`:

```ts
export function utf8Base64(s: string): string {
  // Encode string as UTF-8 bytes, then base64 those bytes.
  // Browser btoa() expects "binary string" (one byte per code unit), so we
  // must convert UTF-8 bytes into that form.
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  // In Node (test env) and in browsers, btoa exists on globalThis.
  return (globalThis as { btoa: (s: string) => string }).btoa(binary);
}
```

- [ ] **Step 4: Run test and verify it passes**

Run: `pnpm test --run src/lib/q-sort/builders.test.ts`
Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/q-sort/builders.ts src/lib/q-sort/builders.test.ts
git commit -m "feat(q-sort): add utf8Base64 helper for CJK-safe encoding"
```

---

## Task 5: `publishThought` — GitHub Contents API wrapper

**Files:**
- Create: `src/lib/q-sort/api.ts`
- Create: `src/lib/q-sort/api.test.ts`

- [ ] **Step 1: Write failing tests with mocked `fetch`**

Create `src/lib/q-sort/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishThought } from './api.js';

describe('publishThought', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('PUTs to the correct URL with the right headers and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ content: { path: 'src/content/thoughts/2026-05-07-0907.md' } }),
    } as unknown as Response);

    const result = await publishThought({
      fetch: fetchMock,
      pat: 'ghp_test',
      repo: 'tumluliu/blogs',
      filename: '2026-05-07-0907.md',
      contentBase64: 'aGVsbG8=',
      message: 'thought: 2026-05-07 09:07 via q-sort',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/tumluliu/blogs/contents/src/content/thoughts/2026-05-07-0907.md',
    );
    expect(init.method).toBe('PUT');
    expect(init.headers['Authorization']).toBe('Bearer ghp_test');
    expect(init.headers['Accept']).toBe('application/vnd.github+json');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      message: 'thought: 2026-05-07 09:07 via q-sort',
      content: 'aGVsbG8=',
      branch: 'master',
    });
    expect(result).toEqual({ ok: true, status: 201 });
  });

  it('returns { ok: false } with status and message on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Bad credentials' }),
    } as unknown as Response);

    const result = await publishThought({
      fetch: fetchMock,
      pat: 'bad',
      repo: 'tumluliu/blogs',
      filename: 'x.md',
      contentBase64: 'eA==',
      message: 'm',
    });

    expect(result).toEqual({ ok: false, status: 401, message: 'Bad credentials' });
  });

  it('returns { ok: false } with a network message on fetch rejection', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await publishThought({
      fetch: fetchMock,
      pat: 'p',
      repo: 'tumluliu/blogs',
      filename: 'x.md',
      contentBase64: 'eA==',
      message: 'm',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toMatch(/network/i);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm test --run src/lib/q-sort/api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `publishThought`**

Create `src/lib/q-sort/api.ts`:

```ts
export interface PublishDeps {
  fetch: typeof fetch;
  pat: string;
  repo: string; // "owner/name"
  filename: string; // e.g. "2026-05-07-0907.md"
  contentBase64: string;
  message: string;
}

export interface PublishResult {
  ok: boolean;
  status: number;
  message?: string;
}

export async function publishThought(deps: PublishDeps): Promise<PublishResult> {
  const url = `https://api.github.com/repos/${deps.repo}/contents/src/content/thoughts/${deps.filename}`;
  try {
    const res = await deps.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${deps.pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: deps.message,
        content: deps.contentBase64,
        branch: 'master',
      }),
    });

    if (res.ok) {
      return { ok: true, status: res.status };
    }
    let msg: string | undefined;
    try {
      const data = await res.json();
      msg = data?.message;
    } catch {
      // body may not be JSON; ignore
    }
    return { ok: false, status: res.status, message: msg };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown error';
    return { ok: false, status: 0, message: `network error: ${reason}` };
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm test --run src/lib/q-sort/api.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/q-sort/api.ts src/lib/q-sort/api.test.ts
git commit -m "feat(q-sort): add publishThought GitHub Contents API wrapper"
```

---

## Task 6: `storage.ts` — `localStorage` config wrapper

**Files:**
- Create: `src/lib/q-sort/storage.ts`

(No test: trivial wrapper around browser-only `localStorage`. Tested implicitly via manual e2e in Task 12.)

- [ ] **Step 1: Implement storage wrapper**

Create `src/lib/q-sort/storage.ts`:

```ts
const PAT_KEY = 'qsort.pat';
const REPO_KEY = 'qsort.repo';
const DEFAULT_REPO = 'tumluliu/blogs';

export interface QSortConfig {
  pat: string | null;
  repo: string;
}

export function loadConfig(): QSortConfig {
  return {
    pat: localStorage.getItem(PAT_KEY),
    repo: localStorage.getItem(REPO_KEY) ?? DEFAULT_REPO,
  };
}

export function saveConfig(pat: string, repo: string): void {
  localStorage.setItem(PAT_KEY, pat);
  localStorage.setItem(REPO_KEY, repo);
}

export function clearConfig(): void {
  localStorage.removeItem(PAT_KEY);
  localStorage.removeItem(REPO_KEY);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm exec astro check`
Expected: 0 errors (warnings on existing code OK; new file should not introduce errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/q-sort/storage.ts
git commit -m "feat(q-sort): add localStorage config wrapper"
```

---

## Task 7: Astro page UI at `/q-sort/`

**Files:**
- Create: `src/pages/q-sort/index.astro`

This is the largest task. The page is intentionally self-contained: it does NOT use `BaseLayout` (we want zero header/footer chrome for app feel) and ships its own minimal HTML/CSS/JS.

- [ ] **Step 1: Create the page**

Create `src/pages/q-sort/index.astro`:

```astro
---
// /q-sort/ — Quick Thought capture PWA. See spec at
// docs/superpowers/specs/2026-05-07-quick-thought-pwa-design.md
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="theme-color" content="#1f2937" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/q-sort-192.png" type="image/png" />
    <link rel="apple-touch-icon" href="/icons/q-sort-192.png" />
    <title>q-sort</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; }
      body {
        font-family: system-ui, -apple-system, sans-serif;
        background: #111827;
        color: #f9fafb;
        display: flex;
        flex-direction: column;
        padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem;
        font-size: 0.85rem;
        color: #9ca3af;
        border-bottom: 1px solid #1f2937;
      }
      #status { flex: 1; }
      #status.error { color: #f87171; }
      #status.ok { color: #34d399; }
      button {
        background: #2563eb;
        color: #fff;
        border: 0;
        padding: 0.6rem 1rem;
        font-size: 1rem;
        border-radius: 0.4rem;
        cursor: pointer;
      }
      button:disabled { background: #374151; cursor: not-allowed; }
      button.ghost { background: transparent; color: #9ca3af; padding: 0.3rem 0.6rem; }
      main { flex: 1; display: flex; flex-direction: column; }
      textarea {
        flex: 1;
        width: 100%;
        background: #0b1220;
        color: #f9fafb;
        border: 0;
        padding: 1rem;
        font-size: 1rem;
        font-family: inherit;
        resize: none;
        outline: none;
      }
      footer { padding: 0.75rem; }
      footer button { width: 100%; }
      dialog {
        background: #1f2937;
        color: #f9fafb;
        border: 0;
        border-radius: 0.5rem;
        padding: 1rem;
        max-width: 90vw;
      }
      dialog::backdrop { background: rgba(0, 0, 0, 0.6); }
      dialog label { display: block; font-size: 0.85rem; margin-top: 0.5rem; color: #9ca3af; }
      dialog input { width: 100%; padding: 0.5rem; margin-top: 0.25rem; background: #0b1220; color: #f9fafb; border: 1px solid #374151; border-radius: 0.3rem; font-family: inherit; }
      dialog .row { display: flex; gap: 0.5rem; margin-top: 1rem; }
      dialog .row button { flex: 1; }
    </style>
  </head>
  <body>
    <header>
      <span id="status">idle</span>
      <button id="settings-btn" class="ghost" aria-label="Settings">⚙</button>
    </header>
    <main>
      <textarea id="body" placeholder="thought…" autofocus inputmode="text" autocapitalize="sentences" spellcheck="true"></textarea>
    </main>
    <footer>
      <button id="publish-btn" disabled>Publish</button>
    </footer>

    <dialog id="settings">
      <h3 style="margin: 0 0 0.5rem 0;">Settings</h3>
      <label for="pat-input">PAT (fine-grained, Contents: Write)</label>
      <input id="pat-input" type="password" autocomplete="off" />
      <label for="repo-input">Repo (owner/name)</label>
      <input id="repo-input" type="text" autocomplete="off" />
      <div class="row">
        <button id="settings-clear" class="ghost">Clear</button>
        <button id="settings-cancel" class="ghost">Cancel</button>
        <button id="settings-save">Save</button>
      </div>
    </dialog>

    <script type="module">
      import { buildFilename, buildMarkdown, utf8Base64 } from '/src/lib/q-sort/builders.ts';
      import { publishThought } from '/src/lib/q-sort/api.ts';
      import { loadConfig, saveConfig, clearConfig } from '/src/lib/q-sort/storage.ts';

      const $ = (id) => document.getElementById(id);
      const status = $('status');
      const body = $('body');
      const publishBtn = $('publish-btn');
      const settingsBtn = $('settings-btn');
      const settingsDialog = $('settings');
      const patInput = $('pat-input');
      const repoInput = $('repo-input');

      let inFlight = false;

      function setStatus(text, kind) {
        status.textContent = text;
        status.className = kind ?? '';
      }

      function refreshPublishEnabled() {
        const cfg = loadConfig();
        const hasBody = body.value.trim().length > 0;
        const hasPat = !!cfg.pat;
        publishBtn.disabled = inFlight || !hasBody || !hasPat;
        if (!hasPat) setStatus('set PAT in settings', 'error');
        else if (status.className === 'error' && status.textContent === 'set PAT in settings') setStatus('idle');
      }

      body.addEventListener('input', refreshPublishEnabled);

      settingsBtn.addEventListener('click', () => {
        const cfg = loadConfig();
        patInput.value = cfg.pat ?? '';
        repoInput.value = cfg.repo;
        settingsDialog.showModal();
      });
      $('settings-cancel').addEventListener('click', () => settingsDialog.close());
      $('settings-save').addEventListener('click', () => {
        const pat = patInput.value.trim();
        const repo = repoInput.value.trim();
        if (pat && repo) {
          saveConfig(pat, repo);
          settingsDialog.close();
          refreshPublishEnabled();
          setStatus('idle');
        }
      });
      $('settings-clear').addEventListener('click', () => {
        clearConfig();
        patInput.value = '';
        repoInput.value = '';
        settingsDialog.close();
        refreshPublishEnabled();
      });

      publishBtn.addEventListener('click', async () => {
        if (inFlight) return;
        const cfg = loadConfig();
        if (!cfg.pat) { setStatus('set PAT in settings', 'error'); return; }
        const text = body.value.trim();
        if (!text) return;

        inFlight = true;
        refreshPublishEnabled();
        setStatus('publishing…');

        const now = new Date();
        const filename = buildFilename(now);
        const md = buildMarkdown(now, text);
        const contentBase64 = utf8Base64(md);
        const stamp = filename.replace('.md', '').replace(/-(\d{2})(\d{2})$/, ' $1:$2');

        const result = await publishThought({
          fetch: window.fetch.bind(window),
          pat: cfg.pat,
          repo: cfg.repo,
          filename,
          contentBase64,
          message: `thought: ${stamp} via q-sort`,
        });

        inFlight = false;

        if (result.ok) {
          body.value = '';
          setStatus('published — deploying (~2 min)', 'ok');
        } else {
          setStatus(`error: ${result.status} ${result.message ?? ''}`.trim(), 'error');
        }
        refreshPublishEnabled();
      });

      // Initial state
      refreshPublishEnabled();
      body.focus();

      // Service worker registration
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('SW registration failed', err);
        });
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Start dev server in background**

Run: `pnpm dev` (in background; expect it to bind 4321)

- [ ] **Step 3: Smoke test in browser**

Open http://localhost:4321/q-sort/ in a browser.

Manually verify:
- Page loads with a textarea and a Publish button.
- Status line reads `set PAT in settings` and Publish is disabled.
- Click ⚙ → modal opens with empty inputs (repo defaults to `tumluliu/blogs`).
- Paste a *test* PAT (any string for now), Save → status returns to `idle`, Publish remains disabled until textarea has content.
- Type some text → Publish enables.
- Click Publish with the fake PAT → status flips to `error: 401 Bad credentials` (or similar). Body preserved. (This proves the API call wiring is correct.)

- [ ] **Step 4: Stop dev server**

- [ ] **Step 5: Commit**

```bash
git add src/pages/q-sort/index.astro
git commit -m "feat(q-sort): add /q-sort/ PWA page UI"
```

---

## Task 8: Generate PWA icons

**Files:**
- Create: `scripts/q-sort/make-icons.ts`
- Create: `public/icons/q-sort-192.png`
- Create: `public/icons/q-sort-512.png`

- [ ] **Step 1: Write the icon generator script**

Create `scripts/q-sort/make-icons.ts`:

```ts
// Usage: pnpm tsx scripts/q-sort/make-icons.ts
// Generates the two PWA icons at public/icons/q-sort-{192,512}.png from
// an inline SVG. Re-run any time you want to tweak the look.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join('public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1f2937"/>
  <text x="256" y="340" font-size="300" font-family="-apple-system, system-ui, sans-serif"
        font-weight="800" fill="#f9fafb" text-anchor="middle">q</text>
</svg>`);

await sharp(svg).resize(192, 192).png().toFile(join(OUT_DIR, 'q-sort-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(OUT_DIR, 'q-sort-512.png'));
console.log('icons written to', OUT_DIR);
```

- [ ] **Step 2: Run the generator**

Run: `pnpm tsx scripts/q-sort/make-icons.ts`
Expected output: `icons written to public/icons`

- [ ] **Step 3: Verify the PNGs exist and are non-empty**

Run: `ls -la public/icons/`
Expected: `q-sort-192.png` (~few KB) and `q-sort-512.png` (~few-tens KB).

- [ ] **Step 4: Commit**

```bash
git add scripts/q-sort/make-icons.ts public/icons/q-sort-192.png public/icons/q-sort-512.png
git commit -m "feat(q-sort): add PWA icon generator and generated icons"
```

---

## Task 9: PWA manifest

**Files:**
- Create: `public/manifest.webmanifest`

- [ ] **Step 1: Create the manifest**

Create `public/manifest.webmanifest`:

```json
{
  "name": "q-sort",
  "short_name": "q-sort",
  "description": "Quick thought capture for luliu.me",
  "start_url": "/q-sort/",
  "scope": "/q-sort/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#111827",
  "theme_color": "#1f2937",
  "icons": [
    { "src": "/icons/q-sort-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/q-sort-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/q-sort-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Verify it serves**

Run: `pnpm dev` (background)
Open http://localhost:4321/manifest.webmanifest — expect the JSON above.

In a Chromium browser open DevTools → Application → Manifest. Should parse cleanly with no errors. "Add to Home Screen" should be available from the browser menu when visiting `/q-sort/`.

- [ ] **Step 3: Stop dev server, commit**

```bash
git add public/manifest.webmanifest
git commit -m "feat(q-sort): add PWA manifest"
```

---

## Task 10: Service worker (offline shell)

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Create the service worker**

Create `public/sw.js`:

```js
// q-sort service worker. Cache-first for the page shell, never cache
// writes to api.github.com.
const CACHE = 'qsort-v1';
const SHELL = [
  '/q-sort/',
  '/manifest.webmanifest',
  '/icons/q-sort-192.png',
  '/icons/q-sort-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept GitHub API.
  if (url.hostname === 'api.github.com') return;

  // Only handle our own origin.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((res) => {
          // Optionally update the cache for shell entries on success.
          if (res.ok && SHELL.includes(url.pathname)) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return res;
        }).catch(() => cached || Response.error())
      );
    }),
  );
});
```

- [ ] **Step 2: Smoke test offline shell**

Run: `pnpm dev` (background)

In Chromium DevTools at http://localhost:4321/q-sort/:

1. Application → Service Workers → confirm `sw.js` registered + activated.
2. Application → Cache Storage → confirm `qsort-v1` exists with the 4 shell entries.
3. DevTools → Network → check "Offline" → reload the page → page shell still loads.
4. With Offline still on, type text and click Publish → status shows a network error (e.g., `error: 0 network error: Failed to fetch`). Body preserved.

- [ ] **Step 3: Stop dev server, commit**

```bash
git add public/sw.js
git commit -m "feat(q-sort): add service worker for offline shell caching"
```

---

## Task 11: `noindex` reinforcement via `robots.txt`

**Files:**
- Create or modify: `public/robots.txt`

- [ ] **Step 1: Check whether `public/robots.txt` exists**

Run: `ls public/robots.txt 2>/dev/null && cat public/robots.txt; ls public/`

If `robots.txt` does not exist, create one. If it does exist, append the `Disallow` line.

- [ ] **Step 2A (file does not exist): Create `public/robots.txt`**

```
User-agent: *
Disallow: /q-sort/
Sitemap: https://luliu.me/sitemap-index.xml
```

- [ ] **Step 2B (file exists): Append `Disallow` line**

Use Edit to add:

```
Disallow: /q-sort/
```

…immediately under any existing `User-agent: *` directive (or under the most permissive section). Do not duplicate the `Disallow` if it is already there.

- [ ] **Step 3: Verify by curl through dev server**

Run: `pnpm dev` (background)
`curl -s http://localhost:4321/robots.txt` — expect to see the `Disallow: /q-sort/` line.

- [ ] **Step 4: Stop dev server, commit**

```bash
git add public/robots.txt
git commit -m "chore(q-sort): disallow /q-sort/ in robots.txt"
```

---

## Task 12: End-to-end live test

**Files:** none (manual verification + small follow-up commits if anything needs fixing).

- [ ] **Step 1: Push everything**

```bash
git push
```

- [ ] **Step 2: Wait for the deploy workflow to succeed**

Run: `gh run list --limit 1 --workflow=deploy.yml`
Expected: most recent run shows `[ok] deploy`.
If failed, inspect with `gh run view <id> --log-failed` and fix.

- [ ] **Step 3: Provision a fine-grained PAT**

On GitHub:
- Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
- Resource owner: `tumluliu`
- Repository access: only `tumluliu/blogs`
- Repository permissions: `Contents` → **Read and write**
- Expiry: 90 days
- Generate, copy

- [ ] **Step 4: Smoke test on Android Chrome**

On the Android device:
1. Open `https://luliu.me/q-sort/`.
2. Tap ⚙ → paste PAT → Save.
3. Type a short thought.
4. Tap Publish.
5. Expect status to flip to `published — deploying (~2 min)`.
6. Open Chrome menu → "Add to Home screen" → confirm icon appears.
7. Tap home-screen icon → page launches fullscreen with textarea autofocused.

- [ ] **Step 5: Verify the thought lands and the deploy publishes it**

```bash
git pull
ls src/content/thoughts/ | tail -3
gh run list --limit 1 --workflow=deploy.yml
```

Expected: a new file `src/content/thoughts/YYYY-MM-DD-HHmm.md` exists with valid frontmatter and your body text. Latest deploy run is green.

Open `https://luliu.me/thoughts/` (or wherever thoughts surface) and confirm the new entry is visible.

- [ ] **Step 6: Smoke test on desktop browser**

Repeat step 4 in a desktop Chrome with a *different* PAT (or the same one) to confirm cross-device behavior.

- [ ] **Step 7: Close the issue**

```bash
gh issue close 1 --comment "Shipped. /q-sort/ live at https://luliu.me/q-sort/, verified on Android + desktop."
```

---

## Self-Review

**Spec coverage:**
- Path `/q-sort/` ✅ Task 7
- Textarea + Publish + status + settings ✅ Task 7
- Settings modal saves PAT/repo to `localStorage` ✅ Task 6 + 7
- Submit flow PUTs Contents API with branch=master ✅ Task 5
- 201 → clear textarea, status published ✅ Task 7
- Error → preserve body, surface message ✅ Task 7
- PWA manifest, `display: standalone`, icons ✅ Task 8 + 9
- Service worker offline shell, never caches `api.github.com` ✅ Task 10
- `noindex` meta + `robots.txt` ✅ Task 7 (meta) + Task 11 (robots)
- Out-of-scope items (tags input, PIN, queue) — correctly absent.
- Acceptance criteria 1–7 — covered by Task 12 manual verification.

**Placeholder scan:** none.

**Type consistency:** `PublishDeps`, `PublishResult`, `QSortConfig` referenced consistently. Function names `buildFilename`, `buildFrontmatter`, `buildMarkdown`, `utf8Base64`, `publishThought`, `loadConfig`, `saveConfig`, `clearConfig` defined once and reused. Filename format `YYYY-MM-DD-HHmm.md` consistent across builder, page, API URL, and acceptance check.
