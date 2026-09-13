import { z } from 'zod';
import { db } from '@/server/db';
import { rateLimit, requestIp } from '@/server/auth';
import { ApiError, checkOrigin, handleError, readJson } from '@/server/http';
import { fetchFeedPhoto } from '@/server/feed-photo';
export const runtime = 'nodejs';
export const maxDuration = 15;
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { itemId } = await readJson(
      request,
      z.object({ itemId: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    );
    await rateLimit(`feed-photo:${requestIp(request)}`, 20, 3600);
    const item = await db.trendItem.findUnique({ where: { id: itemId } });
    if (!item?.imageUrl || !item.categories.length || item.publishedAt > new Date())
      throw new ApiError(
        404,
        'This look has no available photo. Open the story and upload a screenshot.',
      );
    let image;
    try {
      image = await fetchFeedPhoto(item.imageUrl);
    } catch {
      throw new ApiError(
        422,
        'This publisher photo could not be opened. Open the story and upload a screenshot instead.',
      );
    }
    return new Response(new Uint8Array(image.data), {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
