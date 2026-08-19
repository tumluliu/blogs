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
  const current = docTitle(doc);
  // A body H1 stays the single source of truth: rewrite that line rather
  // than injecting a frontmatter title that would contradict it.
  if (current.source === 'h1') {
    return { ...doc, body: doc.body.replace(H1_RE, `# ${title}`) };
  }
  return { ...doc, hadFrontmatter: true, fm: { ...doc.fm, title } };
}

export function patchMeta(doc: Doc, patch: MetaPatch): Doc {
  const fm = { ...doc.fm };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) fm[k] = v;
  }
  return { ...doc, fm, hadFrontmatter: doc.hadFrontmatter || Object.keys(fm).length > 0 };
}
