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

export function fixContent(input: string): string {
  return input;
}
