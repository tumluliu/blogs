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

  it('bold-only line is treated as heading (not merged into body)', () => {
    const blocks = splitBlocks('**引言**\n\nbody');
    expect(blocks).toEqual<Block[]>([
      { kind: 'heading', text: '**引言**' },
      { kind: 'prose', text: 'body' },
    ]);
  });
});

import { mergeParagraphs } from './pandoc-paragraph-fix.js';

describe('mergeParagraphs', () => {
  it('merges three CJK / ASCII / CJK blocks into one when sentence is mid-flow', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS' },
      { kind: 'prose', text: '项目。' },
      { kind: 'prose', text: '下一段从这里开始。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS项目。');
    expect(out[1].text).toBe('下一段从这里开始。');
  });

  it('inserts a space when merging English to English at word boundary', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: 'continued from the' },
      { kind: 'prose', text: 'previous line.' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('continued from the previous line.');
  });

  it('does NOT merge when first paragraph ends with terminator', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '完整的句子。' },
      { kind: 'prose', text: '另一段。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
  });

  it('does NOT merge across heading', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '未完句子' },
      { kind: 'heading', text: '## 新章节' },
      { kind: 'prose', text: '继续。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(3);
  });

  it('does NOT merge across image-only paragraph', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '看下图' },
      { kind: 'image', text: '![](/x.png)' },
      { kind: 'prose', text: '说明文字。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(3);
  });

  it('treats colon as terminator (often introduces list/quote)', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '有以下几点：' },
      { kind: 'prose', text: '第一点。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
  });

  it('treats Chinese closing 」 as terminator', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: '他说「这是好事」' },
      { kind: 'prose', text: '然后离开了。' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
  });

  it('chain-merges multiple short paragraphs until terminator', () => {
    const blocks: Block[] = [
      { kind: 'prose', text: 'foo' },
      { kind: 'prose', text: 'bar' },
      { kind: 'prose', text: 'baz.' },
      { kind: 'prose', text: 'next.' },
    ];
    const out = mergeParagraphs(blocks);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('foo bar baz.');
    expect(out[1].text).toBe('next.');
  });
});

describe('fixContent (integration)', () => {
  it('fixes the dao-tui-style mid-sentence break', () => {
    const input = [
      '---',
      'title: x',
      '---',
      '',
      '本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS\\',
      '\\',
      '项目。\\',
      '\\',
      '下一段从这里开始。',
      '',
    ].join('\n');
    const expected = [
      '---',
      'title: x',
      '---',
      '',
      '本来拉开架势准备继续做我的遥感影像库，然而世事难料，就在我实验正做得起劲的时候，一纸命令把我抽调到北京支援一个MIS项目。',
      '',
      '下一段从这里开始。',
      '',
    ].join('\n');
    expect(fixContent(input)).toBe(expected);
  });

  it('preserves frontmatter verbatim', () => {
    const fm = '---\ntitle: x\nslug: y\ndate: "2025-01-01"\ntags:\n  - a\n  - b\n---\n\n';
    const body = '一段。\n';
    expect(fixContent(fm + body)).toBe(fm + body);
  });

  it('preserves fenced code verbatim', () => {
    const input = '前文\\\n\\\n```js\nconst x = 1;\n\nconst y = 2;\n```\n\n后文。\n';
    const out = fixContent(input);
    expect(out).toContain('```js\nconst x = 1;\n\nconst y = 2;\n```');
  });

  it('is idempotent: running twice = running once', () => {
    const input = '一段中文MIS\\\n\\\n项目。\\\n\\\n下一段。\n';
    const once = fixContent(input);
    const twice = fixContent(once);
    expect(twice).toBe(once);
  });
});
