// One-shot migration: rename root-level *.md files to ASCII-slug names,
// move them into src/content/posts/, and normalize frontmatter.
// Idempotent. Default is dry-run; pass --apply to mutate.
//
// Frontmatter rules:
//   - title: preserve original (Chinese OK); default to filename if absent.
//   - slug: set to the new ASCII slug.
//   - date: parse existing if present; default to file mtime if missing.
//   - updated: keep if present.
//   - tags: drop "Notebooks/" prefix; drop redundant generic "blog" tag.
//   - draft: set to true if body is empty (whitespace only).
//
// Performs git mv. Refuses to run on master/main.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { slugify } from './lib/slugify.js';
import { dedupeSlug } from './lib/dedupe-slug.js';

const REPO_ROOT = process.cwd();
const POSTS_DIR = join(REPO_ROOT, 'src', 'content', 'posts');
const APPLY = process.argv.includes('--apply');

interface RenamePlan {
  oldPath: string;
  newPath: string;
  oldFilename: string;
  newFilename: string;
  title: string;
  isEmpty: boolean;
  tagsBefore: string[];
  tagsAfter: string[];
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t))
    .map((t) => t.replace(/^Notebooks\//i, ''))
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.toLowerCase() !== 'blog')
    .filter((t, i, a) => a.indexOf(t) === i);
}

const SKIP_FILES = new Set(['README.md', 'readme.md', 'CHANGELOG.md', 'LICENSE.md']);

function listRootMarkdown(): string[] {
  return readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !SKIP_FILES.has(f))
    .filter((f) => statSync(join(REPO_ROOT, f)).isFile());
}

function buildPlan(): RenamePlan[] {
  const used = new Set<string>();
  const plan: RenamePlan[] = [];

  for (const file of listRootMarkdown().sort()) {
    const oldPath = join(REPO_ROOT, file);
    const raw = readFileSync(oldPath, 'utf8');
    const parsed = matter(raw);
    const title = String(parsed.data.title || basename(file, '.md')).trim();
    const baseSlug = slugify(title);
    const slug = dedupeSlug(baseSlug, used);
    used.add(slug);

    plan.push({
      oldPath,
      newPath: join(POSTS_DIR, `${slug}.md`),
      oldFilename: file,
      newFilename: `${slug}.md`,
      title,
      isEmpty: parsed.content.trim().length === 0,
      tagsBefore: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
      tagsAfter: normalizeTags(parsed.data.tags),
    });
  }

  return plan;
}

function rewriteFrontmatter(plan: RenamePlan): string {
  const raw = readFileSync(plan.oldPath, 'utf8');
  const parsed = matter(raw);
  const fileMtime = statSync(plan.oldPath).mtime.toISOString();
  const frontmatter: Record<string, unknown> = {
    title: plan.title,
    slug: plan.newFilename.replace(/\.md$/, ''),
    date: parsed.data.date ?? fileMtime,
    ...(parsed.data.updated ? { updated: parsed.data.updated } : {}),
    tags: plan.tagsAfter,
    draft: plan.isEmpty,
    source: 'original',
  };
  const yamlStr = yaml.dump(frontmatter, { lineWidth: 200, quotingType: '"' });
  return `---\n${yamlStr}---\n${parsed.content}`;
}

function ensureBranch() {
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  if (branch === 'master' || branch === 'main') {
    throw new Error(`Refuse to run on ${branch}. Create a feature branch first.`);
  }
  console.log(`Branch: ${branch}`);
}

function main() {
  ensureBranch();
  const plan = buildPlan();

  console.log(`\nRename plan (${plan.length} files):\n`);
  console.log('OLD'.padEnd(60), '→', 'NEW');
  for (const p of plan) {
    const flag = p.isEmpty ? ' (DRAFT)' : '';
    console.log(p.oldFilename.padEnd(60), '→', p.newFilename + flag);
  }

  if (!APPLY) {
    console.log('\nDry run. Pass --apply to execute.');
    return;
  }

  mkdirSync(POSTS_DIR, { recursive: true });

  for (const p of plan) {
    const newContent = rewriteFrontmatter(p);
    writeFileSync(p.oldPath, newContent);
    execSync(`git mv "${p.oldPath}" "${p.newPath}"`, { cwd: REPO_ROOT });
  }

  console.log(`\nApplied ${plan.length} renames to src/content/posts/.`);
}

main();
