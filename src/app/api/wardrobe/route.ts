import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { handleError, json } from '@/server/http';
import { serializeGarment, serializeOutfit, serializeReference } from '@/server/records';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const user = await requireUser();
    const [garments, outfits, references] = await db.$transaction([
      db.garment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
      db.outfit.findMany({ where: { userId: user.id }, include: { pieces: { orderBy: { zIndex: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
      db.reference.findMany({ where: { userId: user.id }, include: { garments: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    return json({ garments: garments.map(serializeGarment), outfits: outfits.map(serializeOutfit), references: references.map(serializeReference) });
  } catch (error) { return handleError(error); }
}
