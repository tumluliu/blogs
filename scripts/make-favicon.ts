// Usage: pnpm tsx scripts/make-favicon.ts
// Renders favicon.ico and apple-touch-icon.png from public/favicon.svg.
//
// Source SVG is the 🌳 (deciduous tree) glyph from Twemoji
// (https://github.com/jdecked/twemoji), MIT-licensed code +
// CC-BY 4.0 graphics. Replace public/favicon.svg with any other SVG
// and re-run this script to rebake the legacy raster outputs.

import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC = 'public';
const SRC_SVG = join(PUBLIC, 'favicon.svg');

const sourceSvg = await readFile(SRC_SVG);

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

// favicon.ico: 32x32 PNG-encoded ICO, transparent background.
const ico32 = await sharp(sourceSvg).resize(32, 32).png().toBuffer();
await writeFile(join(PUBLIC, 'favicon.ico'), pngToIco(ico32, 32));

// apple-touch-icon.png: 180x180 with an opaque cream background so iOS
// home-screen does not paint its own black.
await sharp(sourceSvg)
  .resize(160, 160)
  .extend({
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    background: '#f5f1e8',
  })
  .flatten({ background: '#f5f1e8' })
  .png()
  .toFile(join(PUBLIC, 'apple-touch-icon.png'));

console.log('favicon.ico + apple-touch-icon.png written to', PUBLIC);
