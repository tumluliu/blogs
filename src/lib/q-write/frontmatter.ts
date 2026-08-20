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

const H1_RE = /^#\s+(.+?)[ \t]*$/gm;

// A body can carry more than one `# ` line. `docTitle`/`setDocTitle` only
// ever reason about the *first* one — that's the position the loader's own
// `extractFirstH1` (src/content.config.ts) treats as a post's implicit
// title, so it's the only H1 a legacy post's derived title can ever have
// come from. Built from `matchAll` (not a bare non-global `.match()`) so
// "first" is a deliberate `[0]` pick over every H1 in the body, not an
// accident of the regex having no `/g` flag.
function firstH1(body: string): RegExpMatchArray | null {
  return [...body.matchAll(H1_RE)][0] ?? null;
}

export function docTitle(doc: Doc): { title: string; source: 'fm' | 'h1' | 'none' } {
  const fmTitle = doc.fm.title;
  if (typeof fmTitle === 'string' && fmTitle.trim()) return { title: fmTitle, source: 'fm' };
  const m = firstH1(doc.body);
  if (m) return { title: m[1].trim(), source: 'h1' };
  return { title: '', source: 'none' };
}

export function setDocTitle(doc: Doc, title: string): Doc {
  const fm = { ...doc.fm, title };
  // The title always lands in frontmatter — the corpus's rendering
  // convention (`<h1>{post.data.title}</h1>` from the template, no H1 in
  // the body) has no exception in this repo: all 229 legacy posts already
  // carry `title:` and no body H1.
  //
  // Only the body's *first* H1 is ever a candidate for the drop below —
  // same rationale as `firstH1` above. A later H1 that happens to repeat
  // the title's text is left alone here even though it *is* a real
  // duplicate the page would render twice: silently deleting a heading
  // buried partway through a post's body is a bigger, less obviously-safe
  // edit than dropping the one line sitting where a legacy import's title
  // lives. That case is left for a human to fix — `scripts/check-post-front.ts`
  // scans every H1 (not just the first) precisely so it still gets caught
  // before it ships.
  const m = firstH1(doc.body);
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
