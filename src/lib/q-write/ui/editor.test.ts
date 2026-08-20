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

  it('strips scripts and event handlers out of raw HTML in a draft', () => {
    // The preview runs in a page whose localStorage holds a Contents:Write
    // PAT, and marked passes raw HTML straight through.
    const md = [
      '正文',
      '',
      '<img src=x onerror="window.__pwned = true">',
      '',
      '<script>window.__pwned = true;<\/script>',
      '',
      '<iframe src="https://evil.example"></iframe>',
      '',
      '<a href="javascript:window.__pwned = true">点我</a>',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    expect(container.querySelector('a')?.hasAttribute('href')).toBe(false);
    // the harmless markup around it still renders
    expect(container.textContent).toContain('正文');
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('keeps ordinary links and images intact', () => {
    renderPreview(container, '[q-sort](/q-sort/)\n\n![alt](/media/2026/08/a.webp)', new Map());
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/q-sort/');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/media/2026/08/a.webp');
  });
});

// The 预览 tab inserts parsed markdown into the live document, and that
// document's localStorage holds a `Contents: Write` PAT for the blog repo.
// Everything below is a payload that survived the first version of the
// sanitiser; each one has to stay dead.
describe('renderPreview sanitiser', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  // Type selectors are case-sensitive for non-HTML namespaces and jsdom's
  // selector engine is inconsistent about it, so compare local names directly.
  function tags(root: ParentNode): string[] {
    return Array.from(root.querySelectorAll('*'), (el) => el.localName.toLowerCase());
  }

  it('strips <animate> that retargets an href onto its parent link', () => {
    // SMIL runs in Chrome and Safari: clicking the text navigates to whatever
    // <animate> wrote into the enclosing <a href>, in this page's origin.
    const md = [
      '正文',
      '',
      '<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>click</text></a></svg>',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('animate');
    expect(container.innerHTML).not.toContain('attributeName');
    expect(container.innerHTML).not.toContain('javascript:');
    expect(container.textContent).toContain('正文');
  });

  it('strips <set>, which retargets the same way', () => {
    const md = '<svg><a><set attributeName="href" to="javascript:alert(1)"/><text>click</text></a></svg>';

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('set');
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('strips <animateTransform> and <animateMotion>', () => {
    const md = [
      '<svg><a><animateTransform attributeName="transform" type="translate" values="0;200"/>',
      '<animateMotion path="M0,0 L200,200"/><text>click</text></a></svg>',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('animatetransform');
    expect(tags(container)).not.toContain('animatemotion');
  });

  it('strips <meta http-equiv=refresh> wherever it sits in the draft', () => {
    // A leading <meta> is hoisted into the parsed document's <head> and is
    // dropped by accident; one that follows any other node stays in <body>.
    const md = [
      '<meta http-equiv="refresh" content="0;url=https://evil.example/lead">',
      '',
      '正文',
      '',
      '<meta http-equiv="refresh" content="0;url=https://evil.example/tail">',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('meta');
    expect(container.innerHTML).not.toContain('http-equiv');
    expect(container.innerHTML).not.toContain('evil.example');
  });

  it('strips <base href>, which re-points every relative link on the page', () => {
    const md = ['<base href="https://evil.example/">', '', '正文', '', '<base href="https://evil.example/2/">'].join(
      '\n',
    );

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('base');
    expect(container.innerHTML).not.toContain('evil.example');
  });

  it('strips <style>, which can redress the surrounding UI', () => {
    const md = [
      '<style>#lead{display:none}</style>',
      '',
      '正文',
      '',
      '<style>body{background:red}</style>',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('style');
    expect(container.innerHTML).not.toContain('background:red');
    expect(container.textContent).not.toContain('background:red');
  });

  it('strips a user-supplied style attribute', () => {
    renderPreview(container, '<p style="color:red">red text</p>', new Map());

    const p = container.querySelector('p');
    expect(p?.hasAttribute('style')).toBe(false);
    expect(container.innerHTML).not.toContain('color:red');
    // the harmless markup around it still renders
    expect(p?.textContent).toBe('red text');
  });

  it('strips a style attribute carrying url(...), which can fetch remote CSS/images', () => {
    const md = '<div style="background: url(https://evil.example/track.png)">正文</div>';

    renderPreview(container, md, new Map());

    const div = container.querySelector('div');
    expect(div?.hasAttribute('style')).toBe(false);
    expect(container.innerHTML).not.toContain('evil.example');
    expect(container.textContent).toContain('正文');
  });

  it('strips style from a real cnblogs-import pattern but keeps its text', () => {
    // A representative sample of the legacy inline styling that cnblogs
    // imports carry (color/font-size/FONT-FAMILY cosmetics) — the attribute
    // goes, the text it wraps does not.
    renderPreview(container, '<span style="color: #333399;">文字</span>', new Map());

    const span = container.querySelector('span');
    expect(span?.hasAttribute('style')).toBe(false);
    expect(span?.textContent).toBe('文字');
  });

  it('strips a user style attribute while a highlighted code block keeps its own inline styles', async () => {
    // The style-attribute block must not reach into Shiki's own output:
    // highlightCodeBlocks builds the <pre>/<span> markup with
    // createElement/setAttribute *after* sanitize() has already run, so it
    // never passes through the code path this test is guarding.
    const md = ['<p style="color:red">red text</p>', '', '```rust', 'fn main() {}', '```'].join('\n');

    await renderPreview(container, md, new Map());

    const p = container.querySelector('p');
    expect(p?.hasAttribute('style')).toBe(false);

    const pre = container.querySelector('pre');
    expect(pre?.getAttribute('style')).toContain('white-space: pre-wrap');
    const tokens = Array.from(pre?.querySelectorAll('code span[style]') ?? []);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('strips <link rel=stylesheet>, which fetches remote CSS', () => {
    const md = [
      '<link rel="stylesheet" href="https://evil.example/lead.css">',
      '',
      '正文',
      '',
      '<link rel="stylesheet" href="https://evil.example/tail.css">',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(tags(container)).not.toContain('link');
    expect(container.innerHTML).not.toContain('evil.example');
  });

  it('strips <form>, which can post the page somewhere else', () => {
    renderPreview(container, '正文\n\n<form action="https://evil.example"><button>go</button></form>', new Map());

    expect(tags(container)).not.toContain('form');
    expect(container.innerHTML).not.toContain('evil.example');
  });

  it('walks <template> content, which querySelectorAll does not reach', () => {
    const md = '正文\n\n<template><script>window.__pwned = true;<\/script><img src=x onerror="window.__pwned = true"></template>';

    renderPreview(container, md, new Map());

    const tpl = container.querySelector('template') as HTMLTemplateElement | null;
    if (tpl) {
      expect(tags(tpl.content)).not.toContain('script');
      expect(tpl.content.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    }
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('__pwned');
  });

  it('still renders ordinary markdown in full', () => {
    const md = [
      '# 标题',
      '',
      'some **bold** and `inline code` and [remote](https://example.com/) and [local](/posts/foo/).',
      '',
      '> quote',
      '',
      '- one',
      '- two',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const x = 1;',
      '```',
    ].join('\n');

    renderPreview(container, md, new Map());

    expect(container.querySelector('h1')?.textContent).toBe('标题');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('code')?.textContent).toBe('inline code');
    expect(container.querySelector('pre code')?.textContent).toContain('const x = 1;');
    expect(container.querySelector('blockquote')?.textContent).toContain('quote');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('table td')?.textContent).toBe('1');
    expect(Array.from(container.querySelectorAll('a'), (a) => a.getAttribute('href'))).toEqual([
      'https://example.com/',
      '/posts/foo/',
    ]);
  });

  it('still renders a blob: image source for a freshly inserted photo', () => {
    const blobMap = new Map([['/media/2026/08/x.webp', 'blob:http://localhost:4321/9f2-a1']]);

    renderPreview(container, '![alt](/media/2026/08/x.webp)', blobMap);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:http://localhost:4321/9f2-a1');
  });
});
