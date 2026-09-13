import { db } from '@/server/db';
import { requireUser, rateLimit } from '@/server/auth';
import { preferenceSchema } from '@/lib/for-you';
import { checkOrigin, handleError, json, readJson } from '@/server/http';
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`trend-preferences:${user.id}`, 30, 3600);
    const input = await readJson(request, preferenceSchema);
    const data = {
      ...input,
      categories: [...new Set(input.categories)],
      aesthetics: [...new Set(input.aesthetics)],
    };
    await db.trendPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
