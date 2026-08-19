import { describe, it, expect } from 'vitest';
import { utf8Base64, base64ToUtf8, bytesToBase64 } from './encoding.js';

describe('encoding', () => {
  it('round-trips CJK text', () => {
    const s = '空间记忆：智能系统缺失的认知底座\n\n正文 — with émoji 🚀';
    expect(base64ToUtf8(utf8Base64(s))).toBe(s);
  });

  it('encodes ASCII the same way btoa does', () => {
    expect(utf8Base64('hello')).toBe('aGVsbG8=');
  });

  it('encodes raw bytes (binary image data)', () => {
    expect(bytesToBase64(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('/9j/');
  });

  it('tolerates newlines in base64 returned by the GitHub API', () => {
    const b64 = utf8Base64('abc');
    const wrapped = b64.slice(0, 2) + '\n' + b64.slice(2);
    expect(base64ToUtf8(wrapped)).toBe('abc');
  });
});
