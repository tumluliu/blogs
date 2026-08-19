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
  // Every save goes through this chain, so at most one is ever in flight and
  // they run in the order they were queued.
  let chain: Promise<Draft | null> = Promise.resolve(null);

  // Saves whatever is pending. Returns the draft a failed save put back on the
  // queue, or null when the save succeeded or a newer draft superseded it.
  const run = async (): Promise<Draft | null> => {
    if (!pending) return null;
    const d = pending;
    pending = null;
    try {
      await save(d);
      return null;
    } catch (err) {
      options?.onError?.(err, d);
      // Re-queue the failed draft only if nothing newer is pending
      if (!pending) {
        pending = d;
        return d;
      }
      return null;
    }
  };

  const enqueue = (): Promise<Draft | null> => {
    // The catch keeps a throwing onError from poisoning the chain for every
    // later save, or surfacing as an unhandled rejection from the timer below.
    const next = chain.then(() => run()).catch(() => null);
    chain = next;
    return next;
  };

  return {
    schedule(d: Draft) {
      pending = d;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void enqueue();
      }, delayMs);
    },
    async flush(): Promise<void> {
      // Loop until one pass observes a quiet autosaver: no armed timer, nothing
      // pending, and a chain nothing extended while we awaited it. Re-reading
      // `chain` after every await is what makes that safe — a debounce timer
      // that fires mid-await appends to `chain`, and a lone `await chain` would
      // resolve against the stale snapshot and report "saved" too early.
      let requeued: Draft | null = null;
      for (;;) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        // Drain the pending draft, except when it is the one our own failed save
        // just put back: retrying it here would spin against a failing store.
        // It stays queued for the next schedule() or flush() to pick up.
        if (pending !== null && pending !== requeued) {
          requeued = await enqueue();
          continue;
        }
        const settled = chain;
        await settled;
        if (settled === chain && timer === null && (pending === null || pending === requeued)) {
          return;
        }
      }
    },
  };
}
