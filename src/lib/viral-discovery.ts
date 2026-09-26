import { z } from 'zod';

// Server adapters must supply authorized observations, not model-estimated counters.
// This contract is intentionally separate from editorial RSS and personal feed likes.
export const trendObservationSchema = z
  .object({
    provider: z.string().min(1).max(80),
    platform: z.enum(['instagram', 'tiktok', 'youtube']),
    metricVersion: z.string().min(1).max(80),
    cohort: z.string().min(1).max(120), // e.g. market + short/long format + age bucket
    postId: z.string().min(1).max(200),
    creatorId: z.string().min(1).max(200),
    contentKey: z.string().min(1).max(200), // reviewed/perceptual duplicate cluster
    sourceUrl: z.string().url().max(2000),
    publishedAt: z.string().datetime(),
    observedAt: z.string().datetime(),
    views: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    outfitRelevant: z.boolean(),
  })
  .strict();
export type TrendObservation = z.infer<typeof trendObservationSchema>;
export type RisingFit = {
  observation: TrendObservation;
  viewsAdded: number;
  viewsPerHour: number;
  cohortPercentile: number;
  measuredHours: number;
};

const hour = 3_600_000;
const sourceHosts = { instagram: 'instagram.com', tiktok: 'tiktok.com', youtube: 'youtube.com' };
function sourceMatches(value: TrendObservation) {
  const url = new URL(value.sourceUrl);
  const host = sourceHosts[value.platform];
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    (url.hostname === host ||
      url.hostname === `www.${host}` ||
      (value.platform === 'youtube' && url.hostname === 'youtu.be')) &&
    url.pathname !== '/'
  );
}

/** Produces measured rising candidates, not a claim of universal virality.
 * Thresholds are conservative launch heuristics; calibrate against reviewed real posts.
 * Supply a bounded batch from one ingestion run. No user uploads leave the app here.
 */
export function rankRisingFits(raw: unknown[], now = new Date(), limit = 12): RisingFit[] {
  if (!Number.isFinite(now.getTime()) || raw.length > 10_000) return [];
  const groups = new Map<string, TrendObservation[]>();
  for (const input of raw) {
    const parsed = trendObservationSchema.safeParse(input);
    if (!parsed.success) continue;
    const value = parsed.data;
    if (!value.outfitRelevant || !sourceMatches(value)) continue;
    const published = Date.parse(value.publishedAt),
      observed = Date.parse(value.observedAt);
    if (
      observed > now.getTime() ||
      observed < published ||
      now.getTime() - published > 7 * 24 * hour
    )
      continue;
    const key = JSON.stringify([
      value.provider,
      value.platform,
      value.metricVersion,
      value.cohort,
      value.postId,
    ]);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  const candidates: RisingFit[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    const last = group[group.length - 1];
    if (now.getTime() - Date.parse(last.observedAt) > 6 * hour) continue;
    // Reject resets, inconsistent identity, and contradictory samples at the same time.
    if (
      group.some(
        (v, i) =>
          v.creatorId !== last.creatorId ||
          v.contentKey !== last.contentKey ||
          v.publishedAt !== last.publishedAt ||
          v.sourceUrl !== last.sourceUrl ||
          (i > 0 &&
            (v.views < group[i - 1].views ||
              (v.observedAt === group[i - 1].observedAt && v.views !== group[i - 1].views))),
      )
    )
      continue;
    const first = group.find((v) => {
      const elapsed = Date.parse(last.observedAt) - Date.parse(v.observedAt);
      return elapsed >= hour && elapsed <= 24 * hour;
    });
    if (!first) continue;
    const measuredHours = (Date.parse(last.observedAt) - Date.parse(first.observedAt)) / hour;
    const viewsAdded = last.views - first.views;
    candidates.push({
      observation: last,
      viewsAdded,
      viewsPerHour: viewsAdded / measuredHours,
      measuredHours,
      cohortPercentile: 0,
    });
  }
  const cohorts = new Map<string, RisingFit[]>();
  for (const candidate of candidates) {
    const v = candidate.observation;
    const key = JSON.stringify([v.provider, v.platform, v.metricVersion, v.cohort]);
    const peers = cohorts.get(key) ?? [];
    peers.push(candidate);
    cohorts.set(key, peers);
  }
  const qualified: RisingFit[] = [];
  for (const peers of cohorts.values()) {
    // Collapse reposts before calculating the baseline so repeated uploads cannot skew it.
    const unique = [
      ...new Map(
        peers
          .sort((a, b) => b.viewsPerHour - a.viewsPerHour)
          .map((p) => [p.observation.contentKey, p] as const)
          .reverse(),
      ).values(),
    ];
    if (unique.length < 5 || new Set(unique.map((p) => p.observation.creatorId)).size < 3) continue;
    for (const candidate of unique) {
      candidate.cohortPercentile =
        unique.filter((p) => p.viewsPerHour < candidate.viewsPerHour).length / (unique.length - 1);
      if (
        candidate.viewsAdded >= 500 &&
        candidate.viewsPerHour >= 100 &&
        candidate.cohortPercentile >= 0.75
      )
        qualified.push(candidate);
    }
  }
  qualified.sort(
    (a, b) =>
      b.cohortPercentile - a.cohortPercentile ||
      Date.parse(b.observation.observedAt) - Date.parse(a.observation.observedAt) ||
      a.observation.postId.localeCompare(b.observation.postId),
  );
  const creators = new Set<string>(),
    content = new Set<string>();
  return qualified
    .filter((candidate) => {
      const v = candidate.observation,
        creator = `${v.platform}:${v.creatorId}`;
      if (creators.has(creator) || content.has(v.contentKey)) return false;
      creators.add(creator);
      content.add(v.contentKey);
      return true;
    })
    .slice(0, Math.max(0, Math.min(50, Math.floor(limit) || 0)));
}
