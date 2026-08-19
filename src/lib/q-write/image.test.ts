import { describe, it, expect } from 'vitest';
import { fitLongEdge, hash8, extFromMime } from './image.js';

describe('fitLongEdge', () => {
  it('scales a landscape photo down to the max long edge', () => {
    expect(fitLongEdge(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo by its height', () => {
    expect(fitLongEdge(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales a small image', () => {
    expect(fitLongEdge(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('rounds to whole pixels', () => {
    const { width, height } = fitLongEdge(1000, 333, 500);
    expect(Number.isInteger(width) && Number.isInteger(height)).toBe(true);
  });
});

describe('hash8', () => {
  it('is 8 lowercase hex chars', async () => {
    const h = await hash8(new Uint8Array([1, 2, 3]));
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is stable for identical bytes and different for different bytes', async () => {
    const a = await hash8(new Uint8Array([1, 2, 3]));
    const b = await hash8(new Uint8Array([1, 2, 3]));
    const c = await hash8(new Uint8Array([9, 9, 9]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('extFromMime', () => {
  it('maps encoder output to a file extension', () => {
    expect(extFromMime('image/webp')).toBe('webp');
    expect(extFromMime('image/jpeg')).toBe('jpg');
    expect(extFromMime('image/png')).toBe('png');
  });

  it('falls back to jpg for anything unexpected', () => {
    expect(extFromMime('application/octet-stream')).toBe('jpg');
  });
});
