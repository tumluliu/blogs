import { describe, it, expect } from 'vitest';
import { fixContent } from './pandoc-paragraph-fix.js';

describe('fixContent', () => {
  it('returns input unchanged when there is nothing to fix', () => {
    const input = '一段完整的中文。\n\n第二段。\n';
    expect(fixContent(input)).toBe(input);
  });
});
