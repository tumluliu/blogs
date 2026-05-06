const FENCE_RE = /^```/;

export function stripBackslashes(input: string): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(line.replace(/\s*\\$/, ''));
  }
  return out.join('\n');
}

export type BlockKind = 'prose' | 'heading' | 'list' | 'quote' | 'code' | 'table' | 'image' | 'html' | 'hr';

export interface Block {
  kind: BlockKind;
  text: string;
}

const HEADING_RE = /^#{1,6}\s/;
const LIST_RE = /^(\s*)([-*+]|\d+\.)\s/;
const QUOTE_RE = /^>\s?/;
const HR_SIMPLE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const IMAGE_ONLY_RE = /^!\[[^\]]*\]\([^)]+\)\s*$/;
const HTML_RE = /^<[a-zA-Z!]/;
const TABLE_RE = /^\s*\|/;

function detectKind(line: string): BlockKind {
  if (HEADING_RE.test(line)) return 'heading';
  if (HR_SIMPLE.test(line)) return 'hr';
  if (LIST_RE.test(line)) return 'list';
  if (QUOTE_RE.test(line)) return 'quote';
  if (IMAGE_ONLY_RE.test(line)) return 'image';
  if (HTML_RE.test(line)) return 'html';
  if (TABLE_RE.test(line)) return 'table';
  return 'prose';
}

export function splitBlocks(input: string): Block[] {
  const lines = input.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    if (FENCE_RE.test(lines[i])) {
      const start = i;
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) i++;
      if (i < lines.length) i++;
      blocks.push({ kind: 'code', text: lines.slice(start, i).join('\n') });
      continue;
    }

    const kind = detectKind(lines[i]);
    const start = i;

    if (kind === 'hr' || kind === 'image') {
      blocks.push({ kind, text: lines[i] });
      i++;
      continue;
    }

    while (i < lines.length && lines[i].trim() !== '') {
      if (i > start) {
        const k = detectKind(lines[i]);
        if (k !== kind && !(kind === 'prose' && k === 'prose')) break;
      }
      i++;
    }

    blocks.push({ kind, text: lines.slice(start, i).join('\n') });
  }

  return blocks;
}

const TERMINATORS = new Set([
  '。', '.', '！', '!', '？', '?', '…', ';', '；', ':', '：',
  '」', '』', '"', "'", ')', '）', ']', '】', '>',
]);

function lastVisibleChar(s: string): string {
  const trimmed = s.replace(/\s+$/, '');
  return trimmed.charAt(trimmed.length - 1);
}

function isWordChar(c: string): boolean {
  return /[A-Za-z0-9]/.test(c);
}

function joinText(a: string, b: string): string {
  const aLast = lastVisibleChar(a);
  const bFirst = b.trimStart().charAt(0);
  if (isWordChar(aLast) && isWordChar(bFirst)) return a + ' ' + b;
  return a + b;
}

export function mergeParagraphs(blocks: Block[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < blocks.length) {
    const cur = blocks[i];
    if (cur.kind !== 'prose') {
      out.push(cur);
      i++;
      continue;
    }
    let merged = cur.text;
    let j = i + 1;
    while (j < blocks.length) {
      const last = lastVisibleChar(merged);
      if (TERMINATORS.has(last)) break;
      const next = blocks[j];
      if (next.kind !== 'prose') break;
      merged = joinText(merged, next.text);
      j++;
    }
    out.push({ kind: 'prose', text: merged });
    i = j;
  }
  return out;
}

function splitFrontmatter(input: string): { frontmatter: string; body: string } {
  const m = input.match(/^---\n[\s\S]*?\n---\n+/);
  if (!m) return { frontmatter: '', body: input };
  return { frontmatter: m[0], body: input.slice(m[0].length) };
}

function renderBlocks(blocks: Block[]): string {
  return blocks.map((b) => b.text).join('\n\n');
}

export function fixContent(input: string): string {
  const { frontmatter, body } = splitFrontmatter(input);
  const stripped = stripBackslashes(body);
  const blocks = splitBlocks(stripped);
  const merged = mergeParagraphs(blocks);
  const rendered = renderBlocks(merged);
  const trailing = input.endsWith('\n') ? '\n' : '';
  return frontmatter + (rendered ? rendered + trailing : trailing);
}
