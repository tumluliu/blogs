import yaml from 'js-yaml';

export interface Doc {
  fm: Record<string, unknown>;
  hadFrontmatter: boolean;
  body: string;
}

export interface MetaPatch {
  tags?: string[];
  draft?: boolean;
  slug?: string;
  date?: string;
  updated?: string;
  source?: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseDoc(raw: string): Doc {
  const m = raw.match(FM_RE);
  if (!m) return { fm: {}, hadFrontmatter: false, body: raw };
  const parsed = yaml.load(m[1]);
  const fm = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  return { fm, hadFrontmatter: true, body: raw.slice(m[0].length).replace(/^\r?\n/, '') };
}

export function serializeDoc(doc: Doc): string {
  const body = `${doc.body.replace(/\s+$/u, '')}\n`;
  if (Object.keys(doc.fm).length === 0) return body;
  const block = yaml.dump(doc.fm, { lineWidth: 200 });
  return `---\n${block}---\n\n${body}`;
}

const H1_RE = /^#\s+(.+?)[ \t]*$/m;

export function docTitle(doc: Doc): { title: string; source: 'fm' | 'h1' | 'none' } {
  const fmTitle = doc.fm.title;
  if (typeof fmTitle === 'string' && fmTitle.trim()) return { title: fmTitle, source: 'fm' };
  const m = doc.body.match(H1_RE);
  if (m) return { title: m[1].trim(), source: 'h1' };
  return { title: '', source: 'none' };
}

export function setDocTitle(doc: Doc, title: string): Doc {
  const fm = { ...doc.fm, title };
  const m = doc.body.match(H1_RE);
  // The title always lands in frontmatter — the corpus's rendering
  // convention (`<h1>{post.data.title}</h1>` from the template, no H1 in
  // the body) has no exception in this repo: all 229 legacy posts already
  // carry `title:` and no body H1. A body H1 with the exact same text as
  // the title would render as a second, duplicate heading, so drop that
  // line; an H1 with different text is a deliberate heading and is left
  // alone.
  if (!m || m[1].trim() !== title) {
    return { ...doc, hadFrontmatter: true, fm };
  }
  const start = m.index ?? 0;
  const body = (doc.body.slice(0, start) + doc.body.slice(start + m[0].length))
    .replace(/^(?:\r?\n)+/, '')
    .replace(/(?:\r?\n){3,}/g, '\n\n');
  return { ...doc, hadFrontmatter: true, fm, body };
}

export function patchMeta(doc: Doc, patch: MetaPatch): Doc {
  const fm = { ...doc.fm };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) fm[k] = v;
  }
  return { ...doc, fm, hadFrontmatter: doc.hadFrontmatter || Object.keys(fm).length > 0 };
}
