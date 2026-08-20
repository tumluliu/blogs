// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderPreview } from './editor.js';

function fence(lang: string, code: string): string {
  return ['```' + lang, code, '```'].join('\n');
}

// The published post is rendered by Astro's shiki integration with
// `theme: 'github-dark-dimmed', wrap: true`, which emits
//   <pre class="astro-code github-dark-dimmed"
//        style="background-color:…;color:…; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"
//        tabindex="0" data-language="rust"><code><span class="line">…
// The 预览 tab has to produce the same thing, or it is not a preview.
describe('preview syntax highlighting', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('highlights a known language the way the published page does', async () => {
    await renderPreview(container, fence('rust', 'fn main() {\n    println!("hi");\n}'), new Map());

    const pre = container.querySelector('pre');
    expect(pre?.className).toBe('astro-code github-dark-dimmed');
    expect(pre?.getAttribute('data-language')).toBe('rust');
    expect(pre?.getAttribute('tabindex')).toBe('0');
    // wrap: true — the site's blocks wrap instead of scrolling the page
    expect(pre?.getAttribute('style')).toContain('white-space: pre-wrap');
    expect(pre?.getAttribute('style')).toContain('word-wrap: break-word');
    expect(pre?.getAttribute('style')).toContain('overflow-x: auto');

    // structure, not palette: shiki wraps each source line in .line and each
    // token in a styled span, and a highlighted block has more than one colour.
    const lines = pre?.querySelectorAll('code > span.line') ?? [];
    expect(lines).toHaveLength(3);
    const tokens = Array.from(pre?.querySelectorAll('code span[style]') ?? []);
    expect(tokens.length).toBeGreaterThan(2);
    expect(new Set(tokens.map((t) => t.getAttribute('style'))).size).toBeGreaterThan(1);

    // and the code itself survives verbatim
    expect(pre?.textContent).toBe('fn main() {\n    println!("hi");\n}');
  });

  it('loads a grammar per language, not one bundle for all of them', async () => {
    const md = [fence('bash', 'echo "$USER"'), '', fence('sql', 'select 1 from t;')].join('\n');

    await renderPreview(container, md, new Map());

    const langs = Array.from(container.querySelectorAll('pre'), (p) => p.getAttribute('data-language'));
    expect(langs).toEqual(['bash', 'sql']);
    for (const pre of container.querySelectorAll('pre')) {
      expect(pre.querySelectorAll('code span[style]').length).toBeGreaterThan(0);
    }
  });

  it('renders a fence with no language as plaintext, like the site does', async () => {
    await renderPreview(container, fence('', 'just some words'), new Map());

    const pre = container.querySelector('pre');
    expect(pre?.className).toBe('astro-code github-dark-dimmed');
    expect(pre?.getAttribute('data-language')).toBe('plaintext');
    expect(pre?.textContent).toBe('just some words');
  });

  it('falls back to a plain block for an unknown language instead of throwing', async () => {
    const md = ['正文', '', fence('definitely-not-a-language', 'x := 1'), '', '尾巴'].join('\n');

    await expect(renderPreview(container, md, new Map())).resolves.toBeUndefined();

    const pre = container.querySelector('pre');
    // Astro logs a warning and renders the block as plaintext; same here, so
    // the block is still a properly styled code block.
    expect(pre?.getAttribute('data-language')).toBe('plaintext');
    expect(pre?.textContent).toBe('x := 1');
    // and nothing else in the document was lost
    expect(container.textContent).toContain('正文');
    expect(container.textContent).toContain('尾巴');
  });

  it('leaves inline code alone while highlighting the fence next to it', async () => {
    const md = ['一个 `inline_code()` 例子。', '', fence('rust', 'let x = 1;')].join('\n');

    await renderPreview(container, md, new Map());

    const inline = container.querySelector('p code');
    expect(inline?.textContent).toBe('inline_code()');
    expect(inline?.hasAttribute('style')).toBe(false);
    expect(inline?.closest('pre')).toBeNull();
    expect(inline?.querySelector('span')).toBeNull();
    // the fence beside it is highlighted
    expect(container.querySelector('pre')?.getAttribute('data-language')).toBe('rust');
  });

  it('still strips a <script> from a document that also contains a fence', async () => {
    const md = [
      '正文',
      '',
      '<script>window.__pwned = true;<\/script>',
      '',
      '<img src=x onerror="window.__pwned = true">',
      '',
      fence('bash', 'echo hi'),
    ].join('\n');

    await renderPreview(container, md, new Map());

    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.innerHTML).not.toContain('__pwned');
    expect(container.querySelector('pre')?.getAttribute('data-language')).toBe('bash');
  });

  it('keeps markup inside a fence as text after highlighting', async () => {
    // The highlighter is handed the block's textContent and returns markup of
    // its own, so a fence whose *content* is HTML must not come back as DOM.
    const md = fence('html', '<script>alert(1)<\/script>');

    await renderPreview(container, md, new Map());

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('pre')?.getAttribute('data-language')).toBe('html');
    expect(container.querySelector('pre')?.textContent).toBe('<script>alert(1)<\/script>');
  });
});

// Offline before the chunks are cached, a botched deploy, a grammar that 404s:
// every one of these is a rejected dynamic import, and none of them may cost
// the writer the preview.
describe('preview highlighting fallbacks', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('shiki/core');
    vi.doUnmock('shiki/langs');
    vi.resetModules();
  });

  it('renders a plain code block when the shiki core chunk fails to load', async () => {
    vi.doMock('shiki/core', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { renderPreview: render } = await import('./editor.js');
    const md = ['正文', '', fence('rust', 'fn main() {}'), '', '尾巴'].join('\n');

    await expect(render(container, md, new Map())).resolves.toBeUndefined();

    const code = container.querySelector('pre code');
    expect(code?.textContent).toContain('fn main() {}');
    expect(code?.className).toContain('language-rust');
    expect(container.querySelector('pre')?.hasAttribute('data-language')).toBe(false);
    expect(container.textContent).toContain('正文');
    expect(container.textContent).toContain('尾巴');
  });

  it('renders the block as plaintext when only the grammar chunk fails', async () => {
    vi.doMock('shiki/langs', () => ({
      bundledLanguages: {
        rust: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
      },
    }));
    const { renderPreview: render } = await import('./editor.js');
    const md = ['正文', '', fence('rust', 'fn main() {}')].join('\n');

    await expect(render(container, md, new Map())).resolves.toBeUndefined();

    const pre = container.querySelector('pre');
    expect(pre?.getAttribute('data-language')).toBe('plaintext');
    expect(pre?.textContent).toBe('fn main() {}');
    expect(container.textContent).toContain('正文');
  });
});
