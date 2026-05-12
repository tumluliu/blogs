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
