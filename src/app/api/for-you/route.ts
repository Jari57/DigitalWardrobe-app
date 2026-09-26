import { db } from '@/server/db';
import { sessionUser, requireUser, rateLimit } from '@/server/auth';
import {
  defaultPreferences,
  preferenceSchema,
  rankFeed,
  audienceSchema,
  setAudience,
} from '@/lib/for-you';
import { checkOrigin, handleError, json } from '@/server/http';
import { refreshTrends } from '@/server/trend-feed';
import { feedSources, balancePublishers } from '@/lib/feed-sources';
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
      mode === 'saved'
        ? db.trendItem.findMany({
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
          })
        : Promise.all(
            feedSources.map((source) =>
              db.trendItem.findMany({
                where: {
                  publisher: source.name,
                  categories: { isEmpty: false },
                  publishedAt: { lte: new Date(), gte: new Date(Date.now() - 14 * 86400000) },
                },
                orderBy: { publishedAt: 'desc' },
                take: 30,
              }),
            ),
          ).then((groups) => groups.flat()),
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
    let preferences = preference
      ? preferenceSchema.parse({
          categories: preference.categories,
          aesthetics: preference.aesthetics,
          region: preference.region,
        })
      : defaultPreferences;
    const audience = audienceSchema.safeParse(new URL(request.url).searchParams.get('audience'));
    if (audience.success) preferences = setAudience(preferences, audience.data);
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
    const ranked = rankFeed(items, preferences, combined, mode);
    return json({
      items: mode === 'for-you' ? balancePublishers(ranked, 60) : ranked.slice(0, 60),
      sources: feedSources.map((source) => ({
        name: source.name,
        status: !refresh?.lastAttempt
          ? 'pending'
          : refresh.failedSources.includes(source.name)
            ? 'unavailable'
            : items.some((item) => item.publisher === source.name)
              ? 'available'
              : 'no-current-stories',
      })),
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
