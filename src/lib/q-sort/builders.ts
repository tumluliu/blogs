const pad = (n: number) => n.toString().padStart(2, '0');

export function buildFilename(now: Date): string {
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  return `${y}-${m}-${d}-${hh}${mm}.md`;
}

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
