import { describe, expect, it } from 'vitest';
import { entryIdFromPath } from './entry-id';

describe('entryIdFromPath', () => {
  // The `'src/content/posts'` (no `./`) + matching relative fullPath combo
  // happens not to trip the old `slice(baseDir.length + 1)` bug on its own
  // (no prefix-length mismatch to misfire on), so it is folded into this
  // same assertion as the exact-defect case rather than left standalone —
  // every `it` block here must fail against the old expression.
  it('strips a baseDir carrying a leading ./ prefix (the exact defect), and works without one', () => {
    expect(entryIdFromPath('./src/content/posts', 'src/content/posts/foo.md')).toBe('foo');
    expect(entryIdFromPath('src/content/posts', 'src/content/posts/foo.md')).toBe('foo');
  });

  it('handles a nested entry', () => {
    expect(entryIdFromPath('./src/content/posts', 'src/content/posts/sub/foo.md')).toBe(
      'sub/foo',
    );
  });

  it('handles an absolute fullPath against a relative baseDir', () => {
    const abs = `${process.cwd()}/src/content/posts/foo.md`;
    expect(entryIdFromPath('./src/content/posts', abs)).toBe('foo');
  });

  it('handles a baseDir with a trailing slash', () => {
    expect(entryIdFromPath('./src/content/posts/', 'src/content/posts/foo.md')).toBe('foo');
  });

  it('does not eat leading characters of the filename (feeds dateFromFilename correctly)', () => {
    const id = entryIdFromPath('./src/content/posts', 'src/content/posts/2026-08-20-foo.md');
    expect(id).toBe('2026-08-20-foo');
  });
});
