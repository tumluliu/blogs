// One-shot icon generator: terracotta ground, ink nib mark.
// Run: pnpm tsx scripts/gen-q-write-icons.ts
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = (size: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#b25c2c"/>
  <path d="M150 362 L300 150 L362 194 L212 406 L140 420 Z" fill="#fdfcf9"/>
  <path d="M150 362 L212 406 L140 420 Z" fill="#1a1a1a"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size)))
    .resize(size, size)
    .png()
    .toFile(`public/icons/q-write-${size}.png`);
  console.log(`wrote public/icons/q-write-${size}.png`);
}
