// Usage: pnpm tsx scripts/q-sort/make-icons.ts
// Generates the two PWA icons at public/icons/q-sort-{192,512}.png from
// an inline SVG. Re-run any time you want to tweak the look.

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = join('public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1f2937"/>
  <text x="256" y="340" font-size="300" font-family="-apple-system, system-ui, sans-serif"
        font-weight="800" fill="#f9fafb" text-anchor="middle">q</text>
</svg>`);

await sharp(svg).resize(192, 192).png().toFile(join(OUT_DIR, 'q-sort-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(OUT_DIR, 'q-sort-512.png'));
console.log('icons written to', OUT_DIR);
