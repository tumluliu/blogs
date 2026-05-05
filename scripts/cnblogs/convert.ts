// Convert cached cnblogs posts (JSON containing HTML in `description`) to
// markdown files in src/content/posts/.
//
// - Slug: pinyin from title, deduped against existing posts in src/content/posts/
// - HTML → MD via pandoc subprocess
// - Frontmatter: title, slug, date, tags, source: cnblogs, sourceUrl
// - Idempotent: skips files that already exist (rerun with --overwrite to replace)

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { slugify } from '../lib/slugify.js';
import { dedupeSlug } from '../lib/dedupe-slug.js';

const CACHE_DIR = join('scripts', 'cnblogs-cache');
const POSTS_DIR = join('src', 'content', 'posts');
const OVERWRITE = process.argv.includes('--overwrite');

interface CachedPost {
  postid: string | number;
  title: string;
  description: string; // HTML body
  dateCreated: string;
  categories?: string[];
  mt_keywords?: string;
  permalink?: string;
  link?: string;
}

function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  const inFile = join(tmpdir(), `cnblogs-in-${process.pid}.html`);
  const outFile = join(tmpdir(), `cnblogs-out-${process.pid}.md`);
  writeFileSync(inFile, html);
  try {
    execSync(`pandoc -f html -t gfm --wrap=none "${inFile}" -o "${outFile}"`, { stdio: 'pipe' });
    return readFileSync(outFile, 'utf8');
  } catch (err) {
    throw new Error(`pandoc failed: ${(err as Error).message}`);
  }
}

function existingSlugs(): Set<string> {
  if (!existsSync(POSTS_DIR)) return new Set();
  return new Set(
    readdirSync(POSTS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => basename(f, '.md')),
  );
}

function normalizeCategories(cats: string[] | undefined, keywords?: string): string[] {
  const all = [...(cats ?? [])];
  if (keywords) all.push(...keywords.split(/[,，]/));
  return all
    .map((t) => t.trim())
    // cnblogs prefixes categories with brackets like "[随笔分类]德意志见闻" — strip the prefix
    .map((t) => t.replace(/^\[[^\]]*\]/, ''))
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t, i, a) => a.indexOf(t) === i);
}

function main() {
  if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });

  const used = existingSlugs();
  const cacheFiles = readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Converting ${cacheFiles.length} cached posts...`);

  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of cacheFiles) {
    try {
      const post: CachedPost = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8'));
      const baseSlug = slugify(post.title);
      const slug = dedupeSlug(baseSlug, used);
      const targetPath = join(POSTS_DIR, `${slug}.md`);

      if (!OVERWRITE && existsSync(targetPath)) {
        skipped++;
        continue;
      }

      const md = htmlToMarkdown(post.description || '').trim();
      const frontmatter = {
        title: post.title || '(untitled)',
        slug,
        date: post.dateCreated,
        tags: normalizeCategories(post.categories, post.mt_keywords),
        source: 'cnblogs',
        sourceUrl: post.permalink ?? post.link ?? `https://www.cnblogs.com/rib06/p/${post.postid}.html`,
        draft: md.length === 0,
      };

      const content = `---\n${yaml.dump(frontmatter, { lineWidth: 200, quotingType: '"' })}---\n\n${md}\n`;
      writeFileSync(targetPath, content);
      used.add(slug);
      written++;
    } catch (err) {
      console.error(`Error on ${file}:`, (err as Error).message);
      errors++;
    }
  }

  console.log(`Wrote: ${written}, skipped: ${skipped}, errors: ${errors}`);
}

main();
