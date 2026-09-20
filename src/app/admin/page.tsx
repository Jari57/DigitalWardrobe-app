import { notFound, redirect } from 'next/navigation';
import { sessionUser } from '@/server/auth';
import { db } from '@/server/db';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const user = await sessionUser();
  if (!user) redirect('/login');
  if (!user.isAdmin) notFound();
  const [users, garments, outfits, incomplete] = await Promise.all([
    db.user.count(),
    db.garment.count(),
    db.outfit.count(),
    db.agentRequest.count({ where: { state: { in: ['uncertain', 'dispatched'] } } }),
  ]);
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [metrics, visits, refresh] = await Promise.all([
    db.journeyMetric.groupBy({
      by: ['event'],
      where: { day: { gte: since } },
      _sum: { count: true },
    }),
    db.journeyMetric.groupBy({
      by: ['userId'],
      where: { event: 'visit', day: { gte: since } },
      _count: { day: true },
    }),
    db.trendRefresh.findFirst({ select: { lastSuccess: true, failedSources: true } }),
  ]);
  return (
    <main className="app-shell main-content">
      <div className="stack">
        <a href="/">Back to wardrobe</a>
        <h1>Administration</h1>
        <p>Signed in with your verified administrator Google account.</p>
        <dl>
          <dt>Accounts</dt>
          <dd>{users}</dd>
          <dt>Closet pieces</dt>
          <dd>{garments}</dd>
          <dt>Saved looks</dt>
          <dd>{outfits}</dd>
          <dt>AI requests awaiting settlement</dt>
          <dd>{incomplete}</dd>
        </dl>
        <h2>Last 30 days</h2>
        <p>
          First-party action counts, not a unique-user conversion funnel. No photos, search
          descriptions or retailer URLs are recorded here.
        </p>
        <dl>
          {metrics.map((metric) => (
            <div key={metric.event}>
              <dt>{metric.event.replaceAll('_', ' ')}</dt>
              <dd>{metric._sum.count ?? 0}</dd>
            </div>
          ))}
          <dt>Accounts active on more than one day</dt>
          <dd>{visits.filter((v) => v._count.day > 1).length}</dd>
        </dl>
        <h2>Operations</h2>
        <p>Latest discovery refresh: {refresh?.lastSuccess?.toISOString() ?? 'Not recorded'}.</p>
        <p>Feed sources unavailable: {refresh?.failedSources.length ?? 0}.</p>
        <p>
          Service alert destination:{' '}
          {process.env.OPS_ALERT_WEBHOOK
            ? 'Configured; delivery must be verified.'
            : 'Not configured.'}
        </p>
        <p>
          Provider spending alerts and backup retention require verification in the provider
          dashboards.
        </p>
        <p>Billing is off. Stripe has not been connected.</p>
      </div>
    </main>
  );
}
