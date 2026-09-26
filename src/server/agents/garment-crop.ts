import sharp from 'sharp';
import type { DetectedItem } from '@/lib/discovery';

export function garmentRegion(bounds: DetectedItem['bounds'], width: number, height: number) {
  if (!bounds || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    return null;
  const { left, top, right, bottom } = bounds;
  if (
    [left, top, right, bottom].some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
    right - left < 0.03 ||
    bottom - top < 0.03
  )
    return null;
  // Include edges/buttons without allowing the crop outside the supplied image.
  const x = Math.max(0, Math.floor((left - 0.02) * width));
  const y = Math.max(0, Math.floor((top - 0.02) * height));
  const endX = Math.min(width, Math.ceil((right + 0.02) * width));
  const endY = Math.min(height, Math.ceil((bottom + 0.02) * height));
  if (endX - x < 16 || endY - y < 16) return null;
  return { left: x, top: y, width: endX - x, height: endY - y };
}

export async function garmentReference(data: Uint8Array, bounds: DetectedItem['bounds']) {
  // The stored upload is already EXIF-oriented; coordinates refer to those pixels.
  const input = sharp(data);
  const metadata = await input.metadata();
  const region = garmentRegion(bounds, metadata.width ?? 0, metadata.height ?? 0);
  const image = region ? input.extract(region) : input;
  return image
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}
