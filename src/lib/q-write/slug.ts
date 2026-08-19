import { pinyin } from 'pinyin-pro';

const MAX_LEN = 60;

export function slugify(input: string): string {
  if (!input || !input.trim()) return 'untitled';

  // Strip apostrophes first so "don't" becomes "dont", not "don-t".
  const cleaned = input.replace(/['’‘]/g, '');

  // toneType 'none' matches scripts/lib/slugify.ts (style: 'normal').
  // nonZh 'consecutive' keeps ASCII runs intact instead of splitting them.
  const transliterated = pinyin(cleaned, {
    toneType: 'none',
    type: 'string',
    nonZh: 'consecutive',
  });

  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!slug) return 'untitled';

  if (slug.length > MAX_LEN) {
    const cut = slug.slice(0, MAX_LEN);
    const lastDash = cut.lastIndexOf('-');
    slug = lastDash > 20 ? cut.slice(0, lastDash) : cut;
  }

  return slug;
}
