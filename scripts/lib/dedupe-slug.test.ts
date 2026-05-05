import { describe, it, expect } from 'vitest';
import { dedupeSlug } from './dedupe-slug.js';

describe('dedupeSlug', () => {
  it('returns slug unchanged if not in set', () => {
    expect(dedupeSlug('hello', new Set())).toBe('hello');
  });

  it('appends -2 if slug exists', () => {
    expect(dedupeSlug('hello', new Set(['hello']))).toBe('hello-2');
  });

  it('finds next free suffix', () => {
    expect(dedupeSlug('hello', new Set(['hello', 'hello-2', 'hello-3']))).toBe('hello-4');
  });

  it('does not collide with the slug being inserted', () => {
    const used = new Set(['post', 'post-2']);
    const next = dedupeSlug('post', used);
    expect(next).toBe('post-3');
    used.add(next);
    expect(dedupeSlug('post', used)).toBe('post-4');
  });
});
