import type { Draft } from '../drafts.js';
import { slugify } from '../slug.js';

export function applyTitle(d: Draft, title: string): Draft {
  return { ...d, title, slug: d.slugManual ? d.slug : slugify(title) };
}

export function applySlug(d: Draft, slug: string): Draft {
  return { ...d, slug: slugify(slug), slugManual: true };
}

export function touch(d: Draft, now: Date): Draft {
  return { ...d, updatedAt: now.toISOString() };
}

const CJK = /[\u{3400}-\u{9FFF}\u{F900}-\u{FAFF}\u{3040}-\u{30FF}]/u;

// CJK counts per character, latin per whitespace-delimited word — the same
// convention the blog's own reading-time estimate uses.
export function countWords(body: string): number {
  const cleaned = body.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  let count = 0;
  for (const token of cleaned.split(/\s+/)) {
    if (!token) continue;
    let latinRun = '';
    for (const ch of token) {
      if (CJK.test(ch)) {
        if (latinRun) {
          count++;
          latinRun = '';
        }
        count++;
      } else {
        latinRun += ch;
      }
    }
    if (latinRun.trim()) count++;
  }
  return count;
}

export function createAutosaver(
  save: (d: Draft) => Promise<void>,
  delayMs = 800,
  options?: { onError?: (err: unknown, d: Draft) => void },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Draft | null = null;
  let inFlight: Promise<void> | null = null;

  const run = async () => {
    if (!pending) return;
    const d = pending;
    pending = null;
    try {
      await save(d);
    } catch (err) {
      options?.onError?.(err, d);
      // Re-queue the failed draft only if nothing newer is pending
      if (!pending) {
        pending = d;
      }
    }
  };

  return {
    schedule(d: Draft) {
      pending = d;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        inFlight = run();
      }, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Wait for any in-flight save to complete
      if (inFlight) {
        await inFlight;
        inFlight = null;
      }
      // Save any newly pending draft, tracking it as in-flight
      if (pending) {
        inFlight = run();
        await inFlight;
        inFlight = null;
      }
    },
  };
}
