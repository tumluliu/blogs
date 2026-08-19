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

const CJK = /[㐀-鿿豈-﫿぀-ヿ]/u;

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

export function createAutosaver(save: (d: Draft) => Promise<void>, delayMs = 800) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Draft | null = null;

  const run = async () => {
    if (!pending) return;
    const d = pending;
    pending = null;
    await save(d);
  };

  return {
    schedule(d: Draft) {
      pending = d;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await run();
    },
  };
}
