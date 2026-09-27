import { notFound, redirect } from 'next/navigation';
import { sessionUser } from '@/server/auth';
import { investorEvidence } from '@/server/investor-evidence';
import FinanceScenario from '@/components/FinanceScenario';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Finance & evidence · FitStalker',
  robots: { index: false, follow: false },
};
const dollars = (value: number | null) =>
  value === null ? 'Not established' : `$${value.toFixed(4)}`;
const percent = (value: number | null) =>
  value === null ? 'Not established' : `${value.toFixed(1)}%`;
export default async function InvestorPage() {
  const user = await sessionUser();
  if (!user) redirect('/login');
  if (!user.isAdmin) notFound();
  const report = await investorEvidence();
  const t = report.traction;
  return (
    <main className="admin-room">
      <header className="admin-header">
        <div>
          <a href="/admin">← Control room</a>
          <p className="admin-eyebrow">FINANCE & EVIDENCE</p>
          <h1>
            Prove the progress<span>.</span>
          </h1>
          <p>Measured traction, known costs, and clearly marked assumptions.</p>
        </div>
        <div className="admin-status">
          <strong>Billing off</strong>
          <span>Pre-monetization</span>
        </div>
      </header>
      <nav className="admin-nav" aria-label="Evidence actions">
        <a href="/api/admin/evidence" download>
          Download dated evidence (JSON)
        </a>
        <a href="/admin/investors">Refresh evidence ↻</a>
      </nav>
      <p className="admin-note">
        {report.period.fromInclusive} through{' '}
        {new Date(new Date(report.period.untilExclusive).getTime() - 86400000)
          .toISOString()
          .slice(0, 10)}{' '}
        · 30 completed UTC days. Generated {report.generatedAt}. This is an operational snapshot,
        not audited financial statements.
      </p>
      <section className="admin-stats" aria-label="Financial status">
        {[
          ['In-app MRR', '$0', 'Subscriptions are off'],
          ['In-app ARR', '$0', 'No enabled paid subscription flow'],
          ['Paid-customer CAC', 'Not established', 'Spend and paying-customer data missing'],
          ['Customer LTV', 'Not established', 'Paid retention and margin missing'],
          ['Revenue CAGR', 'Not established', 'No positive revenue baseline or annual history'],
        ].map(([label, value, note]) => (
          <article className="admin-stat finance-stat" key={label}>
            <p>{label}</p>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <p className="admin-note">
        Revenue here covers the app subscription flow only. External contracts, affiliate revenue,
        bank balances and ad accounts are not connected. A projection is not ARR evidence.
      </p>
      <div className="admin-grid admin-two">
        <section className="admin-panel">
          <p className="admin-eyebrow">OBSERVED ACTIVITY</p>
          <h2>Acquisition & repeat use</h2>
          <ul className="admin-ranking">
            <li>
              <span>Retained accounts · all time</span>
              <strong>{t.retainedAccounts}</strong>
            </li>
            <li>
              <span>Retained signups · this window</span>
              <strong>{t.signups}</strong>
            </li>
            <li>
              <span>Retained signups · previous 30 days</span>
              <strong>{t.previousWindowSignups}</strong>
            </li>
            <li>
              <span>Signup growth between windows</span>
              <strong>{percent(t.signupGrowthPercent)}</strong>
            </li>
            <li>
              <span>Active accounts</span>
              <strong>{t.activeAccounts}</strong>
            </li>
            <li>
              <span>Active on multiple days</span>
              <strong>
                {t.activeOnMultipleDays} / {t.activeAccounts}
              </strong>
            </li>
            <li>
              <span>Verified external customers</span>
              <strong>Not established</strong>
            </li>
            <li>
              <span>Cost per signup</span>
              <strong>Spend not connected</strong>
            </li>
          </ul>
          <p className="admin-note">
            Includes unclassified internal/test accounts. Returning on multiple days is not D7/D30
            cohort retention. Zero previous signups cannot establish a percentage growth rate. No
            short-history CAGR is claimed.
          </p>
        </section>
        <section className="admin-panel">
          <p className="admin-eyebrow">DELIVERY ECONOMICS</p>
          <h2>Usefulness & cost to serve</h2>
          <ul className="admin-ranking">
            <li>
              <span>Completed shopping searches</span>
              <strong>{t.completedShoppingSearches}</strong>
            </li>
            <li>
              <span>Searches returning links</span>
              <strong>
                {t.searchesReturningLinks} / {t.completedShoppingSearches}
              </strong>
            </li>
            <li>
              <span>Returned-link rate</span>
              <strong>
                {percent(t.returnedLinkShare === null ? null : t.returnedLinkShare * 100)}
              </strong>
            </li>
            <li>
              <span>Recorded AI spend</span>
              <strong>{dollars(report.costs.recordedAiSpendUsd)}</strong>
            </li>
            <li>
              <span>Outstanding AI reservations</span>
              <strong>{dollars(report.costs.reservedAiSpendUsd)}</strong>
            </li>
            <li>
              <span>Mean settled successful AI action</span>
              <strong>{dollars(report.costs.meanSettledSuccessCostUsd)}</strong>
            </li>
          </ul>
          <p className="admin-note">
            A returned link is not proof of an exact match or purchasable item. AI spend includes
            test/deleted accounts; unit cost uses retained successful settled requests. These are
            different populations. Hosting, labor, marketing and tools are not included.
          </p>
        </section>
      </div>
      <FinanceScenario />
      <section className="admin-panel">
        <p className="admin-eyebrow">INVESTOR READINESS</p>
        <h2>Evidence still to collect</h2>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Required evidence</th>
                <th>Current state</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Acquisition cost</td>
                <td>
                  Period-matched spend, channel attribution, qualified signups and paying
                  conversions
                </td>
                <td>Not connected</td>
              </tr>
              <tr>
                <td>D7/D30 retention</td>
                <td>
                  Stable signup cohorts with matured observation windows and test-account exclusions
                </td>
                <td>Not yet established</td>
              </tr>
              <tr>
                <td>MRR / ARR</td>
                <td>Active recurring contracts, normalized pricing, refunds and cancellations</td>
                <td>Billing intentionally off</td>
              </tr>
              <tr>
                <td>LTV / payback</td>
                <td>Observed paid cohorts, churn and gross margin; sufficient sample size</td>
                <td>Scenario only</td>
              </tr>
              <tr>
                <td>Burn / runway</td>
                <td>Cash reconciliation plus complete expense and cash-inflow records</td>
                <td>Scenario only</td>
              </tr>
              <tr>
                <td>Matching advantage</td>
                <td>Held-out known-item results, direct purchase coverage and false-exact rate</td>
                <td>Small baseline only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="admin-panel">
        <h2>How to read the evidence</h2>
        <ul className="admin-audit">
          {report.limitations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="admin-note">
          Definitions:{' '}
          <a href="https://stripe.com/resources/more/how-to-use-monthly-recurring-revenue-mrr-and-annual-recurring-revenue-arr-to-guide-growth">
            MRR and ARR
          </a>{' '}
          · <a href="https://stripe.com/resources/more/essential-saas-metrics">SaaS metrics</a>.
          These references define terms; they do not validate FitStalker’s performance.
        </p>
      </section>
    </main>
  );
}
