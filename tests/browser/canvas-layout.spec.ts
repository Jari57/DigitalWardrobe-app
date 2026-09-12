import { test, expect } from '@playwright/test';
import { arrange } from '../../src/components/OutfitCanvas';
import type { Garment } from '../../src/lib/types';
test('all twelve automatically arranged pieces stay on the canvas without overlaps', () => {
  const garments = Array.from({ length: 12 }, (_, i) => ({ id: String(i) }) as Garment);
  for (let count = 1; count <= 12; count++) {
    const pieces = arrange(garments.slice(0, count));
    expect(pieces).toHaveLength(count);
    for (const p of pieces) {
      expect(p.x + 34 * p.scale).toBeLessThanOrEqual(100);
      expect(p.y + 25 * p.scale).toBeLessThanOrEqual(100);
    }
    for (let i = 0; i < pieces.length; i++)
      for (let j = i + 1; j < pieces.length; j++) {
        const a = pieces[i],
          b = pieces[j];
        expect(
          a.x + 34 * a.scale <= b.x ||
            b.x + 34 * b.scale <= a.x ||
            a.y + 25 * a.scale <= b.y ||
            b.y + 25 * b.scale <= a.y,
        ).toBe(true);
      }
  }
});
