import { relative } from 'node:path';

// Compute a content-loader entry id: the path of `fullPath` relative to
// `baseDir`, with backslashes normalised to `/` and a trailing `.md`
// removed. Uses node:path's `relative` so it is correct regardless of
// whether either argument carries a `./` prefix, a trailing slash, or is
// absolute while the other is relative.
export function entryIdFromPath(baseDir: string, fullPath: string): string {
  const rel = relative(baseDir, fullPath).replace(/\\/g, '/');
  return rel.replace(/\.md$/, '');
}
