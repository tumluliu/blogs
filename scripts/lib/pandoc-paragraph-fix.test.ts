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
