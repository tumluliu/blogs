import { defineCollection, z } from 'astro:content';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import matter from 'gray-matter';

// Pull the first markdown H1 (`# Heading`) out of the body so a post can
// declare its title without YAML frontmatter.
function extractFirstH1(body: string): string | null {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

// Recognise filenames like `2026-05-08-2153.md` or `2026-05-08.md` so a
// thought or post can carry its date in the filename when frontmatter is
// absent.
function dateFromFilename(name: string): Date | null {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, hh = '0', mm = '0'] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm));
}

interface LoaderContext {
  store: { set(entry: Record<string, unknown>): void };
  parseData<T>(opts: { id: string; data: Record<string, unknown> }): Promise<T>;
  generateDigest(data: string): string;
  renderMarkdown(content: string): Promise<{ html: string; metadata: unknown }>;
}

function buildLoader(name: string, baseDir: string, kind: 'post' | 'thought') {
  return {
    name,
    async load(ctx: LoaderContext) {
      const dirEntries = await readdir(baseDir, { recursive: true, withFileTypes: true });
      const mdFiles = dirEntries
        .filter((d) => d.isFile() && d.name.endsWith('.md'))
        .map((d) => {
          // d.parentPath available in Node 20+; relative path from baseDir
          const parent = (d as unknown as { parentPath: string }).parentPath ?? baseDir;
          return join(parent, d.name);
        });

      for (const full of mdFiles) {
        const raw = await readFile(full, 'utf-8');
        const { data: fm, content } = matter(raw);
        const idRaw = full.slice(baseDir.length + 1).replace(/\\/g, '/');
        const id = idRaw.replace(/\.md$/, '');
        const filename = basename(id);
        const stats = await stat(full);

        const enriched: Record<string, unknown> = { ...fm };

        if (kind === 'post') {
          enriched.title = fm.title ?? extractFirstH1(content) ?? filename;
          enriched.slug = fm.slug ?? filename;
          enriched.date = fm.date ?? dateFromFilename(filename) ?? stats.mtime.toISOString();
          if (!Array.isArray(fm.tags)) enriched.tags = [];
          enriched.draft = fm.draft ?? false;
          enriched.source = fm.source ?? 'original';
        } else {
          enriched.date = fm.date ?? dateFromFilename(filename) ?? stats.mtime.toISOString();
          if (!Array.isArray(fm.tags)) enriched.tags = [];
        }

        const data = await ctx.parseData({ id, data: enriched });
        const rendered = await ctx.renderMarkdown(content);
        ctx.store.set({
          id,
          data,
          body: content,
          filePath: full,
          digest: ctx.generateDigest(raw),
          rendered,
        });
      }
    },
  };
}

const posts = defineCollection({
  loader: buildLoader('posts-loader', './src/content/posts', 'post'),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      slug: z.string().min(1).optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      draft: z.boolean().default(false),
      source: z.enum(['original', 'cnblogs']).default('original'),
      sourceUrl: z.string().url().optional(),
    }),
});

const thoughts = defineCollection({
  loader: buildLoader('thoughts-loader', './src/content/thoughts', 'thought'),
  schema: z.object({
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts, thoughts };
