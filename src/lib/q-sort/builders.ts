const pad = (n: number) => n.toString().padStart(2, '0');

export function buildFilename(now: Date): string {
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  return `${y}-${m}-${d}-${hh}${mm}.md`;
}
