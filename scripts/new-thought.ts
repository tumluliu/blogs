// Usage: pnpm new-thought
// Creates src/content/thoughts/YYYY-MM-DD-HHmm.md with frontmatter.

import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const now = new Date();
const pad = (n: number) => n.toString().padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const path = join('src', 'content', 'thoughts', `${stamp}.md`);

if (existsSync(path)) {
  console.error(`File already exists: ${path}`);
  process.exit(1);
}

const frontmatter = {
  date: now.toISOString(),
  tags: [] as string[],
};

const content = `---\n${yaml.dump(frontmatter, { lineWidth: 200 })}---\n\n`;
writeFileSync(path, content);
console.log(`Created ${path}`);
