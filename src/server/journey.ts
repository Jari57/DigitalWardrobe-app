import { db } from '@/server/db';
export type JourneyEvent =
  | 'visit'
  | 'upload'
  | 'identification'
  | 'shopping_results'
  | 'retailer_click'
  | 'piece_saved'
  | 'service_failure';
// First-party counters only: never store photos, descriptions, URLs, IPs or query text.
export async function recordJourney(userId: string, event: JourneyEvent) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await db.journeyMetric.upsert({
      where: { userId_day_event: { userId, day, event } },
      create: { userId, day, event },
      update: event === 'visit' ? {} : { count: { increment: 1 } },
    });
  } catch {
    /* Measurement must not fail a user action or recreate a deleted account. */
  }
}
