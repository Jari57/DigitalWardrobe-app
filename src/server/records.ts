import type { Garment, Outfit, OutfitPiece, Reference, ReferenceGarment, Prisma } from '@prisma/client';
import { db } from './db';
import { ApiError } from './http';

export const imageIdFromUrl = (url: string) => url.slice('/api/images/'.length);
export const serializeGarment = (item: Garment) => ({ id: item.id, name: item.name, brand: item.brand, category: item.category, color: item.color, price: item.price === null ? null : Number(item.price), imageUrl: `/api/images/${item.imageId}`, wearCount: item.wearCount, createdAt: item.createdAt.toISOString() });
export const serializeOutfit = (item: Outfit & { pieces: OutfitPiece[] }) => ({ id: item.id, name: item.name, pieces: item.pieces.map(({ garmentId, x, y, scale, zIndex }) => ({ garmentId, x, y, scale, zIndex })), createdAt: item.createdAt.toISOString() });
export const serializeReference = (item: Reference & { garments: ReferenceGarment[] }) => ({ id: item.id, name: item.name, imageUrl: `/api/images/${item.imageId}`, garmentIds: item.garments.map(g => g.garmentId), createdAt: item.createdAt.toISOString() });
type Client = Prisma.TransactionClient | typeof db;
export async function ownImage(userId: string, imageUrl: string, client: Client = db) {
  const imageId = imageIdFromUrl(imageUrl);
  if (!await client.image.findFirst({ where: { id: imageId, userId }, select: { id: true } })) throw new ApiError(400, 'Upload a photo from your own account.');
  return imageId;
}
export async function ownGarments(userId: string, ids: string[], client: Client = db) {
  const unique = [...new Set(ids)];
  if (await client.garment.count({ where: { userId, id: { in: unique } } }) !== unique.length) throw new ApiError(400, 'One or more selected garments are unavailable.');
}
