import { z } from 'zod';
export const trafficSchema = z
  .object({
    page: z.enum(['/', '/login', '/how-it-works', '/privacy', '/terms', '/cookies']),
    channel: z.enum(['direct', 'search', 'social', 'internal', 'referral']),
    device: z.enum(['mobile', 'tablet', 'desktop']),
  })
  .strict();
export function referralChannel(referrer: string): z.infer<typeof trafficSchema>['channel'] {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'fitstalker.com') return 'internal';
    if (/(^|\.)(google\.[a-z.]+|bing.com|duckduckgo.com|search.yahoo.com)$/.test(host))
      return 'search';
    if (
      /(^|\.)(instagram.com|tiktok.com|facebook.com|pinterest.com|youtube.com|t.co|x.com|reddit.com)$/.test(
        host,
      )
    )
      return 'social';
    return 'referral';
  } catch {
    return 'direct';
  }
}
