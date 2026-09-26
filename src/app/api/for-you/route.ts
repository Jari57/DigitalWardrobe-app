import { db } from '@/server/db';
import { sessionUser, requireUser, rateLimit } from '@/server/auth';
import { defaultPreferences, preferenceSchema, rankFeed } from '@/lib/for-you';
import { checkOrigin, handleError, json } from '@/server/http';
import { refreshTrends } from '@/server/trend-feed';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const user = await sessionUser(),
      mode = new URL(request.url).searchParams.get('mode') ?? 'for-you';
    // Recover when the scheduled refresh is missed, with the same global lock and cooldown.
    if (mode !== 'saved') {
      const previous = await db.trendRefresh.findUnique({ where: { id: 'fashion-feeds' } });
      if (!previous?.lastAttempt || +previous.lastAttempt < Date.now() - 45 * 60000) {
        await refreshTrends().catch(() => console.warn('Feed refresh unavailable'));
      }
    }
    const [items, preference, feedback, refresh] = await Promise.all([
      db.trendItem.findMany({
        where: {
          categories: { isEmpty: false },
          publishedAt: {
            lte: new Date(),
            ...(mode === 'saved' ? {} : { gte: new Date(Date.now() - 14 * 86400000) }),
          },
          ...(mode === 'saved'
            ? { feedback: { some: { userId: user?.id ?? '__no_user__', saved: true } } }
            : {}),
        },
        orderBy: { publishedAt: 'desc' },
        take: 150,
      }),
      user ? db.trendPreference.findUnique({ where: { userId: user.id } }) : null,
      user
        ? db.trendFeedback.findMany({
            where: { userId: user.id },
            include: { item: { select: { categories: true, aesthetics: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 500,
          })
        : [],
      db.trendRefresh.findUnique({ where: { id: 'fashion-feeds' } }),
    ]);
    const preferences = preference
      ? preferenceSchema.parse({
          categories: preference.categories,
          aesthetics: preference.aesthetics,
          region: preference.region,
        })
      : defaultPreferences;
    // Old saves/hides must remain effective even after more than 500 newer interactions.
    const visibleFeedback = user
      ? await db.trendFeedback.findMany({
          where: { userId: user.id, itemId: { in: items.map((item) => item.id) } },
          include: { item: { select: { categories: true, aesthetics: true } } },
        })
      : [];
    const combined = [
      ...new Map([...feedback, ...visibleFeedback].map((entry) => [entry.itemId, entry])).values(),
    ];
    return json({
      items: rankFeed(items, preferences, combined, mode).slice(0, 60),
      preferences,
      authenticated: !!user,
      checkedAt: refresh?.lastSuccess,
      attemptedAt: refresh?.lastAttempt,
      stale: !refresh?.lastSuccess || +refresh.lastSuccess < Date.now() - 2 * 3600000,
      sourcesUnavailable: !!refresh?.failedSources.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    await rateLimit(`feed-refresh:${user.id}`, 12, 3600);
    return json(await refreshTrends(true));
  } catch (error) {
    return handleError(error);
  }
}
