import { describe, it, expect } from 'vitest';
import { fixContent, stripBackslashes } from './pandoc-paragraph-fix.js';

describe('fixContent', () => {
  it('returns input unchanged when there is nothing to fix', () => {
    const input = '一段完整的中文。\n\n第二段。\n';
    expect(fixContent(input)).toBe(input);
  });
});

describe('stripBackslashes', () => {
  it('removes trailing \\ on prose lines', () => {
    expect(stripBackslashes('一段中文\\\n\\\n下一段。')).toBe('一段中文\n\n下一段。');
  });

  it('removes trailing \\ at end of file', () => {
    expect(stripBackslashes('结尾\\')).toBe('结尾');
  });

  it('preserves \\ inside fenced code blocks', () => {
    const input = '```bash\necho foo\\\nbar\n```';
    expect(stripBackslashes(input)).toBe(input);
  });

  it('handles empty input', () => {
    expect(stripBackslashes('')).toBe('');
  });

  it('does not strip \\ that is not at end of line', () => {
    expect(stripBackslashes('foo \\ bar')).toBe('foo \\ bar');
  });
});

import { splitBlocks, type Block } from './pandoc-paragraph-fix.js';

describe('splitBlocks', () => {
  it('splits two paragraphs', () => {
    const blocks = splitBlocks('a\n\nb');
    expect(blocks).toEqual<Block[]>([
      { kind: 'prose', text: 'a' },
      { kind: 'prose', text: 'b' },
    ]);
  });

  it('typed block: heading', () => {
    const blocks = splitBlocks('# Title\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'heading', text: '# Title' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: list', () => {
    const blocks = splitBlocks('- one\n- two\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'list', text: '- one\n- two' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: blockquote', () => {
    const blocks = splitBlocks('> quote\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'quote', text: '> quote' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: hr', () => {
    const blocks = splitBlocks('---\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'hr', text: '---' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: image-only', () => {
    const blocks = splitBlocks('![alt](/x.png)\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'image', text: '![alt](/x.png)' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('typed block: code fence preserves blank lines and content', () => {
    const blocks = splitBlocks('```js\nconst x = 1;\n\nconst y = 2;\n```\n\nafter');
    expect(blocks).toEqual<Block[]>([
      { kind: 'code', text: '```js\nconst x = 1;\n\nconst y = 2;\n```' },
      { kind: 'prose', text: 'after' },
    ]);
  });

  it('typed block: html', () => {
    const blocks = splitBlocks('<div>x</div>\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'html', text: '<div>x</div>' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('table block', () => {
    const blocks = splitBlocks('| a | b |\n| - | - |\n| 1 | 2 |\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'table', text: '| a | b |\n| - | - |\n| 1 | 2 |' },
      { kind: 'prose', text: 'body' },
    ]);
  });

  it('multi-line prose paragraph stays as one block', () => {
    const blocks = splitBlocks('line one\nline two\n\nnext');
    expect(blocks).toEqual<Block[]>([
      { kind: 'prose', text: 'line one\nline two' },
      { kind: 'prose', text: 'next' },
    ]);
  });
});
