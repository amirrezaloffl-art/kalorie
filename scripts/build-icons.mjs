// Renders public/icons/icon.svg into the PNG sizes needed by iOS and the web manifest.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('../public/icons/', import.meta.url);
const svg = await readFile(new URL('icon.svg', dir));

const out = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-512-maskable.png', 512, 56],
];
for (const [name, size, pad] of out) {
  const inner = size - pad * 2;
  const img = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: pad ? '#7C5CFA' : { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, left: pad, top: pad }])
    .png()
    .toFile(fileURLToPath(new URL(name, dir)));
  console.log('wrote', name);
}
