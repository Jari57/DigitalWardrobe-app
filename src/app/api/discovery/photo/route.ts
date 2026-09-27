import { z } from 'zod';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, handleError } from '@/server/http';
import { fetchProductPhoto } from '@/server/agents/product-photo';
import { productEvidence } from '@/server/agents/product-evidence';
import { safeShoppingUrl } from '@/lib/discovery';

export const runtime = 'nodejs';
export const maxDuration = 25;

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const input = z
      .object({ search: z.string().min(1).max(80), item: z.string().url().max(2000) })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    // Only photos belonging to this user's stored search can be fetched. Never an open URL proxy.
    const search = await db.agentRequest.findFirst({
      where: { id: input.search, userId: user.id, agent: 'shop' },
      select: { result: true },
    });
    const stored = z
      .object({
        listings: z.array(
          z.object({
            url: z.string(),
            evidence: z.object({ imageUrl: z.string().optional() }).passthrough().optional(),
          }),
        ),
      })
      .safeParse(search?.result);
    const listing = stored.success
      ? stored.data.listings.find((entry) => entry.url === input.item)
      : undefined;
    if (!listing || !safeShoppingUrl(listing.url)) throw new ApiError(404, 'Photo unavailable.');
    await rateLimit(`shopping-photo:${user.id}`, 120, 600);
    const storedImageUrl = listing.evidence?.imageUrl;
    let photo: Awaited<ReturnType<typeof fetchProductPhoto>> | undefined;
    if (storedImageUrl) {
      try {
        photo = await fetchProductPhoto(storedImageUrl);
      } catch {
        // A saved CDN URL can expire. Re-read only this owned listing's metadata below.
      }
    }
    if (!photo) {
      try {
        // One metadata lookup and, at most, one distinct replacement photo. No AI action.
        const refreshedImageUrl = (await productEvidence(listing.url)).imageUrl;
        if (refreshedImageUrl && refreshedImageUrl !== storedImageUrl) {
          photo = await fetchProductPhoto(refreshedImageUrl);
        }
      } catch {
        // Missing metadata or an unavailable replacement remains a normal empty-photo response.
      }
    }
    if (!photo) throw new ApiError(404, 'Photo unavailable.');
    return new Response(new Uint8Array(photo.data), {
      headers: {
        'Content-Type': photo.mimeType,
        'Cache-Control': 'private, max-age=1800',
        Vary: 'Cookie',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
