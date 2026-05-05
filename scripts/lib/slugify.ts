import { pinyin } from 'pinyin';

const MAX_LEN = 60;

export function slugify(input: string): string {
  if (!input || !input.trim()) return 'untitled';

  // Strip apostrophes and similar joining marks before any other processing
  // (so "don't" → "dont", not "don-t")
  const cleaned = input.replace(/['’‘]/g, '');

  // Convert any Chinese characters to pinyin (no tones)
  const transliterated = pinyin(cleaned, {
    style: 'normal',
    heteronym: false,
  })
    .map((arr: string[]) => arr[0])
    .join(' ');

  // Lowercase, replace non-alphanumerics with hyphen, collapse hyphens, trim
  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!slug) return 'untitled';

  // Truncate at word boundary if too long
  if (slug.length > MAX_LEN) {
    const cut = slug.slice(0, MAX_LEN);
    const lastDash = cut.lastIndexOf('-');
    slug = lastDash > 20 ? cut.slice(0, lastDash) : cut;
  }

  return slug;
}
