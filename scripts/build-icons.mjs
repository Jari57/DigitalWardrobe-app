import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/icons', { recursive: true });
await Promise.all(
  [192, 512, 180].map((size) =>
    sharp('public/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`),
  ),
);
const inset = await sharp('public/icon.svg').resize(300, 300).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#faf9f6' } })
  .composite([{ input: inset, gravity: 'centre' }])
  .png()
  .toFile('public/icons/maskable-512.png');
