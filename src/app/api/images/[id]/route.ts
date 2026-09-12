import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { handleError, ApiError } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const image = await db.image.findFirst({ where: { id, userId: user.id }, select: { data: true, mimeType: true } });
    if (!image) throw new ApiError(404, 'Photo not found.');
    return new Response(new Uint8Array(image.data), { headers: { 'Content-Type': image.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Cross-Origin-Resource-Policy': 'same-origin' } });
  } catch (error) { return handleError(error); }
}
