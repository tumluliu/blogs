// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { wrapSelection, insertAtCursor, prefixLine, renderPreview } from './editor.js';

function ta(value: string, start: number, end = start): HTMLTextAreaElement {
  const el = document.createElement('textarea');
  el.value = value;
  el.selectionStart = start;
  el.selectionEnd = end;
  return el;
}

describe('wrapSelection', () => {
  it('wraps the selected text', () => {
    const el = ta('hello world', 6, 11);
    wrapSelection(el, '**', '**');
    expect(el.value).toBe('hello **world**');
  });

  it('inserts empty markers and parks the cursor between them', () => {
    const el = ta('x', 1);
    wrapSelection(el, '**', '**');
    expect(el.value).toBe('x****');
    expect(el.selectionStart).toBe(3);
  });
});

describe('insertAtCursor', () => {
  it('splices text in at the caret', () => {
    const el = ta('ab', 1);
    insertAtCursor(el, 'XY');
    expect(el.value).toBe('aXYb');
    expect(el.selectionStart).toBe(3);
  });

  it('replaces the selection', () => {
    const el = ta('abcd', 1, 3);
    insertAtCursor(el, 'Z');
    expect(el.value).toBe('aZd');
  });
});

describe('prefixLine', () => {
  it('prefixes the line the caret sits on', () => {
    const el = ta('one\ntwo\nthree', 5);
    prefixLine(el, '## ');
    expect(el.value).toBe('one\n## two\nthree');
  });

  it('does not double-apply an existing prefix', () => {
    const el = ta('## two', 3);
    prefixLine(el, '## ');
    expect(el.value).toBe('## two');
  });
});

describe('renderPreview', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders markdown to HTML', () => {
    renderPreview(container, '# hi\n\nsome **bold** text.', new Map());
    expect(container.querySelector('h1')?.textContent).toBe('hi');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('swaps a local path for its blob URL before rendering', () => {
    const blobMap = new Map([['/media/2026/08/a3f91c02.webp', 'blob:local-1']]);
    renderPreview(container, '![alt](/media/2026/08/a3f91c02.webp)', blobMap);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('blob:local-1');
  });

  it('replaces an uploading placeholder instead of leaving a dead link', () => {
    renderPreview(container, '![alt](uploading:img-3)', new Map());
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('图片上传中');
  });
});
