import { notFound, redirect } from 'next/navigation';
import { sessionUser } from '@/server/auth';
import { adminOverview } from '@/server/admin-overview';
import { configuredAgentBudget } from '@/server/agents/ledger';
import AdminControls from '@/components/AdminControls';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Control room · FitStalker',
  robots: { index: false, follow: false },
};
const money = (micros: number) => `$${(micros / 1e6).toFixed(4)}`;
const stamp = (date: Date | null | undefined) =>
  date ? date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'Not recorded';
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const user = await sessionUser();
  if (!user) redirect('/login');
  if (!user.isAdmin) notFound();
  const input = await searchParams;
  const days = [7, 30, 90].includes(Number(input.days)) ? Number(input.days) : 30;
  const data = await adminOverview(days);
  const policy = process.env.AI_ENABLED === 'true' ? configuredAgentBudget() : null;
  const cap = Math.min(policy?.dailyCapMicros ?? 0, data.control.dailyCapMicros ?? Infinity);
  const views = data.traffic.reduce((sum, row) => sum + row.views, 0);
  const anonymous = data.traffic
    .filter((row) => !row.signedIn)
    .reduce((sum, row) => sum + row.views, 0);
  const requests = data.agents.reduce((sum, row) => sum + row.count, 0);
  const failures = data.agents
    .filter((row) => ['failed', 'uncertain'].includes(row.state))
    .reduce((sum, row) => sum + row.count, 0);
  const totals = new Map<string, number>();
  for (const row of data.traffic) totals.set(row.day, (totals.get(row.day) ?? 0) + row.views);
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(new Date(data.since).getTime() + i * 86400000).toISOString().slice(0, 10);
    return { day, count: totals.get(day) ?? 0 };
  });
  const peak = Math.max(1, ...daily.map((row) => row.count));
  const outcomeTotals = new Map<string, number>();
  for (const row of data.agents)
    outcomeTotals.set(row.state, (outcomeTotals.get(row.state) ?? 0) + row.count);
  const coverage = data.shopping.searches
    ? Math.round((data.shopping.withResults / data.shopping.searches) * 100)
    : null;
  const budgetUsed = (data.budget?.spentMicros ?? 0) + (data.budget?.heldMicros ?? 0);
  const breakdown = (key: 'page' | 'channel' | 'device') => {
    const sums = new Map<string, number>();
    for (const row of data.traffic) sums.set(row[key], (sums.get(row[key]) ?? 0) + row.views);
    return [...sums].sort((a, b) => b[1] - a[1]);
  };
  return (
    <main className="admin-room">
      <header className="admin-header">
        <div>
          <a href="/">← FitStalker</a>
          <p className="admin-eyebrow">OWNER WORKSPACE</p>
          <h1>
            Control room<span>.</span>
          </h1>
          <p>Your product, in focus. Activity, quality and service controls.</p>
        </div>
        <div className="admin-status">
          <strong>Billing off</strong>
          <span>{data.control.aiPaused ? 'AI paused' : policy ? 'AI enabled' : 'AI disabled'}</span>
          <small>Updated {stamp(new Date())}</small>
        </div>
      </header>
      <nav className="admin-nav" aria-label="Dashboard range">
        <a href="/admin/investors">Finance &amp; evidence</a>
        {[7, 30, 90].map((range) => (
          <a
            key={range}
            aria-current={days === range ? 'page' : undefined}
            href={`/admin?days=${range}`}
          >
            {range} days
          </a>
        ))}
        <a href={`/admin?days=${days}`}>Refresh data ↻</a>
      </nav>
      <section className="admin-stats" aria-label="Overview">
        {[
          ['Page views', views.toLocaleString(), `${anonymous.toLocaleString()} signed-out views`],
          [
            'Active accounts',
            data.active.active.toLocaleString(),
            `${data.active.returning} active on multiple days`,
          ],
          ['New accounts', data.newUsers.toLocaleString(), `${data.users} accounts total`],
          ['AI requests', requests.toLocaleString(), `${failures} failed or uncertain`],
          [
            'AI spend today',
            money(data.budget?.spentMicros ?? 0),
            `${money(data.budget?.heldMicros ?? 0)} reserved · ${money(cap)} limit`,
          ],
        ].map(([label, value, note]) => (
          <article className="admin-stat" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <section className="admin-panel">
        <div className="admin-section-title">
          <div>
            <p className="admin-eyebrow">REACH</p>
            <h2>Traffic over time</h2>
          </div>
          <span>
            {data.since} → {data.today} · UTC
          </span>
        </div>
        <div className="admin-chart-scale" aria-hidden="true">
          <span>{peak} views</span>
          <span>Daily volume</span>
        </div>
        <div
          className="admin-chart"
          role="img"
          aria-label={`Daily page views. ${views} total in ${days} days.`}
        >
          {daily.map(({ day, count }) => (
            <div key={day} title={`${day}: ${count} page views`}>
              <i style={{ height: `${(count / peak) * 100}%`, minHeight: count ? 3 : 0 }} />
              <small>{days <= 7 ? day.slice(5) : ''}</small>
            </div>
          ))}
        </div>
        <div className="admin-chart-scale" aria-hidden="true">
          <span>{data.since}</span>
          <span>{data.today}</span>
        </div>
        {!views && (
          <p className="admin-empty">
            Traffic appears here as visitors browse after this release. Historical anonymous traffic
            is unavailable.
          </p>
        )}
        <details>
          <summary>Daily counts</summary>
          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date (UTC)</th>
                  <th>Page views</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="admin-note">
          Cookieless page views, not unique people. No IPs, search text or referrer URLs are stored
          in these aggregates. Privacy preferences, blocked scripts and bots affect coverage. Device
          and channel are approximate. Traffic is retained for 90 days.
        </p>
      </section>
      <div className="admin-grid">
        {(['channel', 'device', 'page'] as const).map((key) => (
          <section className="admin-panel" key={key}>
            <h2>
              {key === 'channel'
                ? 'Where visits come from'
                : key === 'device'
                  ? 'Devices'
                  : 'Pages'}
            </h2>
            {breakdown(key).length ? (
              <ul className="admin-ranking">
                {breakdown(key).map(([label, count]) => (
                  <li key={label}>
                    <div className="admin-bar-label">
                      <span>{label === 'direct' ? 'Direct / unknown' : label}</span>
                      <strong>
                        {count.toLocaleString()}{' '}
                        <small>{views ? Math.round((count / views) * 100) : 0}%</small>
                      </strong>
                    </div>
                    <div className="admin-meter" aria-hidden="true">
                      <i style={{ width: `${views ? (count / views) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-empty">No traffic recorded yet.</p>
            )}
          </section>
        ))}
      </div>
      <div className="admin-grid admin-two">
        <section className="admin-panel admin-feature-panel">
          <p className="admin-eyebrow">SEARCH PERFORMANCE</p>
          <h2>Results delivered</h2>
          <div className="admin-coverage">
            <svg
              viewBox="0 0 120 120"
              role="img"
              aria-label={
                coverage === null
                  ? 'No completed searches'
                  : `${coverage}% of completed searches returned links`
              }
            >
              <circle className="admin-ring-track" cx="60" cy="60" r="48" />
              <circle
                className="admin-ring-value"
                cx="60"
                cy="60"
                r="48"
                pathLength="100"
                strokeDasharray={`${coverage ?? 0} 100`}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="65" textAnchor="middle">
                {coverage === null ? '—' : `${coverage}%`}
              </text>
            </svg>
            <div>
              <strong>{data.shopping.withResults.toLocaleString()} searches with links</strong>
              <p className="admin-note">
                Of {data.shopping.searches.toLocaleString()} completed searches. Measures coverage,
                not exact-match accuracy.
              </p>
            </div>
          </div>
        </section>
        <section className="admin-panel">
          <p className="admin-eyebrow">RESOURCE MONITOR</p>
          <h2>Today’s AI budget</h2>
          <p className="admin-budget-number">
            {money(budgetUsed)} <small>/ {money(cap)}</small>
          </p>
          <div
            className="admin-meter admin-budget-meter"
            role="img"
            aria-label={`${money(budgetUsed)} spent or reserved of ${money(cap)} daily cap`}
          >
            <i style={{ width: `${cap ? Math.min(100, (budgetUsed / cap) * 100) : 0}%` }} />
          </div>
          <p className="admin-note">
            Recorded spend plus open reservations.{' '}
            {cap
              ? `${Math.round((budgetUsed / cap) * 100)}% of the daily cap allocated.`
              : 'No active budget.'}{' '}
            Reservations are not settled charges.
          </p>
          <h3 className="admin-outcome-title">Request outcomes · {days} days</h3>
          <ul className="admin-ranking admin-outcomes">
            {[...outcomeTotals].map(([state, count]) => (
              <li key={state}>
                <div className="admin-bar-label">
                  <span>{state}</span>
                  <strong>{count}</strong>
                </div>
                <div
                  className={`admin-meter ${state === 'failed' || state === 'uncertain' ? 'admin-meter-warning' : ''}`}
                  aria-hidden="true"
                >
                  <i style={{ width: `${requests ? (count / requests) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {!requests && <p className="admin-empty">No requests recorded in this period.</p>}
        </section>
      </div>
      <div className="admin-grid admin-two">
        <section className="admin-panel">
          <p className="admin-eyebrow">PRODUCT</p>
          <h2>What people use</h2>
          <ul className="admin-ranking">
            {data.actions.map((row) => (
              <li key={row.event}>
                <span>{row.event.replaceAll('_', ' ')}</span>
                <strong>{row._sum.count ?? 0}</strong>
              </li>
            ))}
          </ul>
          <p className="admin-note">
            Action totals, not a conversion funnel. Daily account counters retain 30 days. Visits
            count each account once per day. {data.garments} closet pieces and {data.outfits}{' '}
            outfits currently saved.
          </p>
        </section>
        <section className="admin-panel">
          <p className="admin-eyebrow">MATCHING</p>
          <h2>Shopping coverage</h2>
          <ul className="admin-ranking">
            <li>
              <span>Completed searches</span>
              <strong>{data.shopping.searches}</strong>
            </li>
            <li>
              <span>Searches returning links</span>
              <strong>{data.shopping.withResults}</strong>
            </li>
            <li>
              <span>Empty searches</span>
              <strong>{data.shopping.searches - data.shopping.withResults}</strong>
            </li>
            <li>
              <span>Listings with photo metadata</span>
              <strong>
                {data.shopping.photos} / {data.shopping.listings}
              </strong>
            </li>
            <li>
              <span>Verified-exact labels</span>
              <strong>{data.shopping.exact}</strong>
            </li>
          </ul>
          <p className="admin-note">
            Photo metadata does not prove an image loaded. Exact labels are pipeline outputs, not
            independently measured accuracy. Deleted accounts and cached requests affect historical
            totals.
          </p>
        </section>
      </div>
      <section className="admin-panel">
        <p className="admin-eyebrow">AGENTS</p>
        <h2>Usage & outcomes</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>State</th>
                <th>Requests</th>
                <th>Recorded cost</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((row) => (
                <tr key={row.agent + row.state}>
                  <td>{row.agent}</td>
                  <td>
                    <span className={`admin-badge ${row.state === 'succeeded' ? 'good' : ''}`}>
                      {row.state}
                    </span>
                  </td>
                  <td>{row.count}</td>
                  <td>{money(row.cost)}</td>
                  <td>{row.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.agents.length && <p className="admin-empty">No AI requests in this period.</p>}
        <p className="admin-note">
          Recorded provider usage, not customer revenue or a complete provider invoice. Unsettled
          requests may still incur costs.
        </p>
      </section>
      <section className="admin-panel">
        <p className="admin-eyebrow">PEOPLE</p>
        <h2>Registered accounts</h2>
        <p className="admin-note">
          Up to 50 accounts ordered by last recorded activity. Anonymous visitors cannot be
          identified. No private photos, prompts or passwords are shown.
        </p>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Joined (UTC)</th>
                <th>Last active day</th>
                <th>AI requests · {days}d</th>
                <th>Recorded cost · {days}d</th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((row) => (
                <tr key={row.id}>
                  <td>{row.username}</td>
                  <td>{row.createdAt.toISOString().slice(0, 10)}</td>
                  <td>{row.lastActive ?? 'No activity recorded'}</td>
                  <td>{row.requests}</td>
                  <td>{money(row.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="admin-grid admin-two">
        <section className="admin-panel">
          <p className="admin-eyebrow">OPERATIONS</p>
          <h2>Service health</h2>
          <ul className="admin-ranking">
            <li>
              <span>Database</span>
              <strong>Connected</strong>
            </li>
            <li>
              <span>Last successful feed refresh</span>
              <strong>{stamp(data.refresh?.lastSuccess)}</strong>
            </li>
            <li>
              <span>Unavailable feed sources</span>
              <strong>{data.refresh?.failedSources.length ?? 0}</strong>
            </li>
            <li>
              <span>Alerts</span>
              <strong>
                {process.env.OPS_ALERT_WEBHOOK
                  ? 'Configured · delivery unverified'
                  : 'Not configured'}
              </strong>
            </li>
            <li>
              <span>Customer billing</span>
              <strong>Off</strong>
            </li>
          </ul>
          {!!data.refresh?.failedSources.length && (
            <p className="admin-note">{data.refresh.failedSources.join(', ')}</p>
          )}
          <p className="admin-note">
            A dashboard query is not uptime history. Backup recovery and alert delivery require
            separate verification.
          </p>
        </section>
        <section className="admin-panel">
          <p className="admin-eyebrow">CONTROL</p>
          <h2>AI guardrails</h2>
          {policy ? (
            <AdminControls
              key={data.control.version}
              control={data.control}
              ceiling={policy.dailyCapMicros}
              minimum={policy.maxRequestMicros}
              userCeiling={policy.requestsPerUser}
            />
          ) : (
            <p>AI is disabled in deployment settings. Billing remains off.</p>
          )}
        </section>
      </div>
      <section className="admin-panel">
        <h2>Latest AI activity</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Account</th>
                <th>Agent</th>
                <th>Outcome</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((row) => (
                <tr key={row.id}>
                  <td>{stamp(row.createdAt)}</td>
                  <td>{row.user.username}</td>
                  <td>{row.agent}</td>
                  <td>{row.state}</td>
                  <td>{row.actualMicros === null ? 'Unsettled' : money(row.actualMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <h2>Control history</h2>
        {data.audit.length ? (
          <ul className="admin-audit">
            {data.audit.map((row) => (
              <li key={row.id}>
                <strong>{row.username ?? 'Deleted administrator'}</strong> · {stamp(row.createdAt)}
                <p>
                  AI {row.details.after.aiPaused ? 'paused' : 'resumed'} · daily ceiling{' '}
                  {row.details.after.dailyCapMicros === null
                    ? 'deployment default'
                    : money(row.details.after.dailyCapMicros)}{' '}
                  · actions/account {row.details.after.requestsPerUser ?? 'deployment default'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-empty">
            No control changes yet. Every saved change is recorded here.
          </p>
        )}
      </section>
    </main>
  );
}
