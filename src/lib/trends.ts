import { z } from 'zod';
import { safeShoppingUrl } from './discovery';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value);
export const trendEditionSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), region: z.literal('US/UK'), reviewedAt: date,
  sources: z.array(z.object({ id: z.string(), publisher: z.string(), title: z.string(), url: z.string().refine(value => !!safeShoppingUrl(value)), publishedAt: date })).min(1),
  picks: z.array(z.object({ id: z.string(), name: z.string().min(1).max(80), evidence: z.string().max(180), idea: z.string().max(180), aesthetic: z.string().max(120), sourceId: z.string(), color: z.string().regex(/^#[0-9a-f]{6}$/) })).min(1).max(10),
}).superRefine((edition, ctx) => {
  if (new Set(edition.sources.map(s => s.id)).size !== edition.sources.length || new Set(edition.picks.map(p => p.id)).size !== edition.picks.length) ctx.addIssue({ code: 'custom', message: 'Duplicate edition IDs' });
  if (edition.reviewedAt.slice(0,7) !== edition.month || edition.sources.some(s => s.publishedAt > edition.reviewedAt)) ctx.addIssue({ code: 'custom', message: 'Invalid source or edition chronology' });
  if (edition.picks.some(p => !edition.sources.some(s => s.id === p.sourceId))) ctx.addIssue({ code: 'custom', message: 'Trend requires a source' });
});
export type TrendEdition = z.infer<typeof trendEditionSchema>;
export function selectTrendEdition(editions: TrendEdition[], now = new Date()) {
  const today = now.toISOString().slice(0,10), month = today.slice(0,7);
  const edition = [...editions].filter(e => e.month <= month && e.reviewedAt <= today).sort((a,b) => b.month.localeCompare(a.month))[0];
  return edition ? { edition, previous: edition.month !== month } : { edition: null, previous: false };
}
