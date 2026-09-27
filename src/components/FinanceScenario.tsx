'use client';
import { useState } from 'react';
import { financeScenario, type FinanceAssumptions } from '@/lib/finance-metrics';
const fields: { key: keyof FinanceAssumptions; label: string; max: number; step: string }[] = [
  { key: 'price', label: 'Monthly price per paying account (USD)', max: 100000, step: '0.01' },
  { key: 'payingAccounts', label: 'Hypothetical paying accounts', max: 100000000, step: '1' },
  { key: 'churnPercent', label: 'Monthly customer churn (%)', max: 100, step: '0.1' },
  { key: 'marginPercent', label: 'Gross margin (%)', max: 100, step: '0.1' },
  {
    key: 'acquisitionSpend',
    label: 'Monthly sales + marketing spend (USD)',
    max: 1000000000,
    step: '0.01',
  },
  { key: 'newPayingAccounts', label: 'New paying accounts that month', max: 100000000, step: '1' },
  {
    key: 'cashOutflow',
    label: 'Total monthly cash outflow, all costs (USD)',
    max: 1000000000,
    step: '0.01',
  },
  { key: 'cash', label: 'Available business cash (USD)', max: 1000000000, step: '0.01' },
];
export default function FinanceScenario() {
  const [values, setValues] = useState<Record<string, string>>({});
  const input = Object.fromEntries(
    fields.map(({ key, max }) => [
      key,
      values[key]?.trim() ? (Number(values[key]) <= max ? Number(values[key]) : NaN) : null,
    ]),
  ) as FinanceAssumptions;
  const result = financeScenario(input);
  const usd = (value: number | null | undefined) =>
    value === null || value === undefined
      ? 'Needs inputs'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        }).format(value);
  const months = (value: number | null | undefined) =>
    value === null || value === undefined ? 'Not established' : `${value.toFixed(1)} months`;
  return (
    <section className="admin-panel">
      <p className="admin-eyebrow">ASSUMPTIONS ONLY</p>
      <h2>Model the business</h2>
      <p className="admin-note">
        These are hypothetical inputs, not measured performance. They stay in this page until
        refresh, are not saved or included in the evidence export, and cannot turn on billing.
      </p>
      <div className="admin-grid admin-two admin-controls">
        {fields.map(({ key, label, max, step }) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min="0"
              max={max}
              step={step}
              value={values[key] ?? ''}
              placeholder="Not entered"
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {!result && (
        <p role="alert">
          Use nonnegative numbers, whole account counts, and percentages from 0 to 100.
        </p>
      )}
      <div className="admin-grid admin-two finance-results" aria-live="polite">
        <ul className="admin-ranking">
          <li>
            <span>Scenario MRR</span>
            <strong>{usd(result?.mrr)}</strong>
          </li>
          <li>
            <span>Scenario ARR</span>
            <strong>{usd(result?.arr)}</strong>
          </li>
          <li>
            <span>Scenario CAC</span>
            <strong>{usd(result?.cac)}</strong>
          </li>
          <li>
            <span>Scenario gross-profit LTV</span>
            <strong>{usd(result?.ltv)}</strong>
          </li>
        </ul>
        <ul className="admin-ranking">
          <li>
            <span>Scenario CAC payback</span>
            <strong>{months(result?.paybackMonths)}</strong>
          </li>
          <li>
            <span>Scenario monthly net cash burn</span>
            <strong>{usd(result?.burn)}</strong>
          </li>
          <li>
            <span>Scenario runway</span>
            <strong>
              {result?.burn !== null && result?.burn !== undefined && result.burn <= 0
                ? 'No positive burn in this scenario'
                : months(result?.runwayMonths)}
            </strong>
          </li>
        </ul>
      </div>
      <p className="admin-note">
        ARR = monthly recurring revenue × 12. CAC = sales/marketing spend ÷ new paying accounts.
        Gross-profit LTV = monthly price × gross margin ÷ monthly churn, using constant-churn
        assumptions. Zero churn does not establish infinite LTV. Runway assumes monthly revenue is
        collected as cash and all costs are in total outflow; acquisition spend must be included
        there once, not added twice. Missing or zero denominators remain unestablished.
      </p>
      <button type="button" onClick={() => setValues({})}>
        Clear scenario
      </button>
    </section>
  );
}
