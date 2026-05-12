import { describe, expect, it } from 'vitest';
import { readingStats } from './reading-stats';

describe('readingStats', () => {
  it('counts pure CJK characters and estimates minutes', () => {
    const text = '中'.repeat(500);
    const { words, minutes } = readingStats(text);
    expect(words).toBe(500);
    // 500 / 300 ≈ 1.67 → round → 2
    expect(minutes).toBe(2);
  });

  it('counts pure ASCII words and estimates minutes', () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const { words, minutes } = readingStats(text);
    expect(words).toBe(500);
    // 500 / 200 = 2.5 → round → 3
    expect(minutes).toBe(3);
  });

  it('combines CJK chars and ASCII words', () => {
    const text = '中'.repeat(300) + ' ' + Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
    const { words, minutes } = readingStats(text);
    expect(words).toBe(400);
    // 300/300 + 100/200 = 1 + 0.5 = 1.5 → round → 2
    expect(minutes).toBe(2);
  });

  it('strips fenced code blocks', () => {
    const text = '中'.repeat(100) + '\n```js\nconsole.log("hello");\n```\n' + '中'.repeat(100);
    const { words } = readingStats(text);
    expect(words).toBe(200);
  });

  it('strips inline code', () => {
    const text = '中文 `code that should not count` 中文';
    const { words } = readingStats(text);
    // 中文 + 中文 = 4 CJK chars; ASCII inside backticks dropped
    expect(words).toBe(4);
  });

  it('strips image refs but keeps link text', () => {
    const text = '看 ![alt text](/img.png) 这个 [点这里](https://example.com)';
    const { words } = readingStats(text);
    // CJK: 看, 这, 个, 点, 这, 里 = 6; ASCII stripped from images, kept from link text but link text is CJK
    expect(words).toBe(6);
  });

  it('returns minutes >= 1 for tiny inputs', () => {
    expect(readingStats('').minutes).toBe(1);
    expect(readingStats('hi').minutes).toBe(1);
  });
});
