// Usage: pnpm new-post "Post title here"
// Creates src/content/posts/<slug>.md with valid frontmatter, draft: true.

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { slugify } from './lib/slugify.js';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: pnpm new-post "Post title"');
  process.exit(1);
}

const slug = slugify(title);
const path = join('src', 'content', 'posts', `${slug}.md`);

if (existsSync(path)) {
  console.error(`File already exists: ${path}`);
  process.exit(1);
}

const now = new Date().toISOString();
const frontmatter = {
  title,
  slug,
  date: now,
  tags: [] as string[],
  draft: true,
  source: 'original',
};

const content = `---\n${yaml.dump(frontmatter, { lineWidth: 200 })}---\n\n`;
writeFileSync(path, content);
console.log(`Created ${path}`);
