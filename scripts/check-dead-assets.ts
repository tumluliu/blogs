// Walk dist/**/*.html, fail if any <img src> or <a href> points to a
// missing local file. Catches the class of bug where markdown emits raw
// relative paths but the asset isn't actually served (e.g. when a custom
// content loader bypasses the Vite asset pipeline).
//
// Skips:
//   - external (http/https/protocol-relative/mailto/tel)
//   - data: URIs
//   - in-page anchors (#foo)
//   - query-only/hash-only resolved paths
//
// Exit 0 if clean, 1 if any dead asset is found.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';

const DIST = resolve('dist');
const PUBLIC_DIR = resolve('public');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full)));
    else if (ent.isFile() && ent.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function isExternal(url: string): boolean {
  return (
    /^[a-z][a-z0-9+\-.]*:/i.test(url) || // any scheme: http, mailto, tel, data, etc.
    url.startsWith('//') ||
    url.startsWith('#')
  );
}

function stripFragmentAndQuery(url: string): string {
  return url.split('#')[0].split('?')[0];
}

function resolveTarget(htmlFile: string, url: string): string {
  const clean = stripFragmentAndQuery(url);
  if (!clean) return '';
  if (clean.startsWith('/')) {
    // Absolute site path. Astro emits assets under dist/, public assets are
    // copied into dist/ at build time too — so a single root lookup works.
    return join(DIST, clean);
  }
  return resolve(dirname(htmlFile), clean);
}

// Astro emits route URLs without `.html`. Resolve `/posts/foo/` to
// `dist/posts/foo/index.html` and `/posts/foo` to either `dist/posts/foo.html`
// or `dist/posts/foo/index.html`.
function existsAsRouteOrFile(target: string): boolean {
  if (!target) return true;
  if (existsSync(target)) return true;
  if (existsSync(target + '.html')) return true;
  if (existsSync(join(target, 'index.html'))) return true;
  // Also accept pretty URLs that strip trailing slash
  if (target.endsWith('/') && existsSync(join(target, 'index.html'))) return true;
  return false;
}

// Only enforce existence for asset-like URLs (img/script/link) and clearly
// file-like hrefs. For <a href> we still report missing if it looks like an
// internal route.
type Hit = { html: string; tag: string; attr: string; url: string };

function extract(body: string): Hit[] {
  const hits: Hit[] = [];
  // <img src="...">
  for (const m of body.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) {
    hits.push({ html: '', tag: 'img', attr: 'src', url: m[1] });
  }
  // <source src="..."> and srcset="..."
  for (const m of body.matchAll(/<source\b[^>]*?\bsrc=["']([^"']+)["']/gi)) {
    hits.push({ html: '', tag: 'source', attr: 'src', url: m[1] });
  }
  // <script src="...">
  for (const m of body.matchAll(/<script\b[^>]*?\bsrc=["']([^"']+)["']/gi)) {
    hits.push({ html: '', tag: 'script', attr: 'src', url: m[1] });
  }
  // <link href="...">
  for (const m of body.matchAll(/<link\b[^>]*?\bhref=["']([^"']+)["']/gi)) {
    hits.push({ html: '', tag: 'link', attr: 'href', url: m[1] });
  }
  // <a href="..."> — internal only
  for (const m of body.matchAll(/<a\b[^>]*?\bhref=["']([^"']+)["']/gi)) {
    hits.push({ html: '', tag: 'a', attr: 'href', url: m[1] });
  }
  return hits;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error(`check-dead-assets: ${DIST} not found. Run \`pnpm build\` first.`);
    process.exit(2);
  }

  const htmls = await walk(DIST);
  const dead: { html: string; tag: string; url: string; target: string }[] = [];

  for (const html of htmls) {
    const body = await readFile(html, 'utf-8');
    for (const hit of extract(body)) {
      if (isExternal(hit.url)) continue;
      const target = resolveTarget(html, hit.url);
      if (!target) continue;
      if (existsAsRouteOrFile(target)) continue;
      dead.push({ html, tag: hit.tag, url: hit.url, target });
    }
  }

  if (dead.length === 0) {
    console.log(`check-dead-assets: ok (${htmls.length} HTML files scanned)`);
    return;
  }

  console.error(`check-dead-assets: ${dead.length} dead reference(s):`);
  for (const d of dead) {
    console.error(
      `  ${relative(process.cwd(), d.html)}  <${d.tag}>  ${d.url}  -> missing ${relative(
        process.cwd(),
        d.target,
      )}`,
    );
  }
  console.error('');
  console.error('Hint: move assets to public/, or use absolute /paths, or fix the broken link.');
  process.exit(1);
}

void main();
