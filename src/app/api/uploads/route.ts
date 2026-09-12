import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, ApiError } from '@/server/http';
import { normalizeImage, uploadFile } from '@/server/images';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`upload:${user.id}`, 50, 3600);
    const normalized = await normalizeImage(await uploadFile(request));
    const scans = await db.agentRequest.findMany({ where: { userId: user.id, agent: 'detect' }, select: { result: true } });
    const scannedImageIds = scans.flatMap(scan => {
      const result = scan.result;
      if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.imageUrl !== 'string') return [];
      return [result.imageUrl.slice('/api/images/'.length)];
    });
    const image = await db.$transaction(async tx => {
      // Remove abandoned uploads after a grace period, never linked photos.
      await tx.image.deleteMany({ where: { userId: user.id, id: { notIn: scannedImageIds }, createdAt: { lt: new Date(Date.now() - 86400000) }, garments: { none: {} }, references: { none: {} } } });
      if (await tx.image.count({ where: { userId: user.id } }) >= 1500) throw new ApiError(409, 'Your photo storage is full. Remove items you no longer need.');
      return tx.image.create({ data: { ...normalized, userId: user.id }, select: { id: true } });
    });
    return json({ imageUrl: `/api/images/${image.id}` }, 201);
  } catch (error) { return handleError(error); }
}
