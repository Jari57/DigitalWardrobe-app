import sharp from 'sharp';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
await mkdir('public/icons', { recursive: true });
await Promise.all(
  [192, 512, 180].map((size) =>
    sharp('public/brand/fitstalker-icon.png')
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`),
  ),
);
// The source mark already has a maskable-icon safe area.
await copyFile('public/icons/icon-512.png', 'public/icons/maskable-512.png');
const icon = (await readFile('public/icons/icon-192.png')).toString('base64');
await writeFile(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><image width="192" height="192" href="data:image/png;base64,${icon}"/></svg>`,
);
