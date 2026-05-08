// Usage: pnpm tsx scripts/make-favicon.ts
// Renders the legacy favicon.ico and apple-touch-icon.png from the same
// bird mark used in public/favicon.svg. Re-run any time you tweak the
// SVG or the colours.

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC = 'public';

// The bird path is identical to public/favicon.svg; we bake explicit
// colours per output so each format renders without depending on
// prefers-color-scheme.
const birdPath = 'M10 40 Q22 22 32 36 Q42 22 54 40';

function svg({ stroke, bg }: { stroke: string; bg?: string }): Buffer {
  const rect = bg ? `<rect width="64" height="64" fill="${bg}"/>` : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  ${rect}
  <path d="${birdPath}" stroke="${stroke}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);
}

// Wrap a 32x32 PNG buffer in a single-image ICO container.
// Modern browsers accept PNG-encoded ICO payload (Vista+).
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // image count

  const dir = Buffer.alloc(16);
  dir.writeUInt8(size === 256 ? 0 : size, 0); // width (0 = 256)
  dir.writeUInt8(size === 256 ? 0 : size, 1); // height
  dir.writeUInt8(0, 2); // color palette
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // color planes
  dir.writeUInt16LE(32, 6); // bits per pixel
  dir.writeUInt32LE(png.length, 8); // size in bytes
  dir.writeUInt32LE(22, 12); // offset = header + dir = 6 + 16

  return Buffer.concat([header, dir, png]);
}

// favicon.ico: 32x32, charcoal stroke, transparent background. Reads
// well in light browser tabs and is acceptable in dark ones; modern
// browsers prefer the SVG anyway.
const ico32 = await sharp(svg({ stroke: '#1f2937' }))
  .resize(32, 32)
  .png()
  .toBuffer();
await writeFile(join(PUBLIC, 'favicon.ico'), pngToIco(ico32, 32));

// apple-touch-icon.png: 180x180, opaque cream background, charcoal
// stroke. iOS home-screen icons must be opaque; the cream tone matches
// the calm, bookish feel.
await sharp(svg({ stroke: '#1f2937', bg: '#f5f1e8' }))
  .resize(180, 180)
  .png()
  .toFile(join(PUBLIC, 'apple-touch-icon.png'));

console.log('favicon.ico + apple-touch-icon.png written to', PUBLIC);
