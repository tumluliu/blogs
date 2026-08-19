const pad = (n: number) => n.toString().padStart(2, '0');

export function postPath(slug: string): string {
  return `src/content/posts/${slug}.md`;
}

function mediaDir(now: Date): string {
  return `media/${now.getFullYear()}/${pad(now.getMonth() + 1)}`;
}

// Repo path. Assets must live under public/ — the content loader renders
// markdown outside Vite's asset pipeline, so only site-absolute URLs resolve.
export function mediaPath(now: Date, hash8: string, ext: string): string {
  return `public/${mediaDir(now)}/${hash8}.${ext}`;
}

// The URL written into the markdown, always site-absolute.
export function mediaUrl(now: Date, hash8: string, ext: string): string {
  return `/${mediaDir(now)}/${hash8}.${ext}`;
}

export function slugFromEntryName(name: string): string {
  return name.replace(/\.md$/, '');
}
