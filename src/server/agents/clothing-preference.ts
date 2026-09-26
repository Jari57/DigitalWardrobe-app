import { db } from '@/server/db';
import { selectedAudience } from '@/lib/for-you';

export async function loadClothingPreference(userId: string) {
  const preference = await db.trendPreference.findUnique({
    where: { userId },
    select: { aesthetics: true },
  });
  return selectedAudience(preference ?? { aesthetics: [] }) ?? 'all-styles';
}
