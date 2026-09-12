'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { TrendEdition } from '@/lib/trends';
import { api } from './ui';
type EditionResponse = { edition: TrendEdition | null; previous: boolean };
export default function MonthlyTrends({ onStyle }: { onStyle: (aesthetic: string) => void }) {
  const [data, setData] = useState<EditionResponse>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<EditionResponse>('/api/trends')
      .then((result) => {
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch(() => {
        if (active) setError('The trend edit could not load.');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const edition = data?.edition;
  return (
    <section className="stack" aria-label="Monthly trend edit">
      {error ? (
        <p role="alert">
          {error}{' '}
          <button
            onClick={() => {
              setError('');
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : !data ? (
        <p role="status">Opening the trend edit…</p>
      ) : !edition ? (
        <p>The next sourced edition is being prepared.</p>
      ) : (
        <>
          <div>
            <span className="eyebrow">THE MONTHLY EDIT · {edition.region}</span>
            <h2>
              {new Date(edition.month + '-01T12:00:00Z').toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
              : {edition.picks.length} ideas to try
            </h2>
          </div>
          <p>
            Editorial picks from fashion coverage, not a TikTok popularity ranking. Our styling
            ideas help you make them your own.
          </p>
          <small>
            Reviewed {edition.reviewedAt} · Fall-focused US/UK edition · No AI allowance used to
            browse.
          </small>
          {data.previous && (
            <p role="status">Previous edition. A newer month has not been published yet.</p>
          )}
          {edition.picks.map((pick, index) => {
            const source = edition.sources.find((s) => s.id === pick.sourceId)!;
            return (
              <article className="trend-card stack" key={pick.id}>
                <div className="row">
                  <span
                    className="trend-swatch"
                    style={{ background: pick.color }}
                    aria-hidden="true"
                  />
                  <span className="eyebrow">IDEA {String(index + 1).padStart(2, '0')}</span>
                  <h3>{pick.name}</h3>
                </div>
                <p>{pick.evidence}</p>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.publisher} · {source.publishedAt}
                  <ArrowUpRight size={13} />
                </a>
                <div className="note">
                  <strong>Make it yours</strong>
                  <p>{pick.idea}</p>
                </div>
                <div className="row wrap">
                  <button onClick={() => onStyle(pick.aesthetic)}>
                    <Sparkles size={15} />
                    Style with my closet
                  </button>
                  <a
                    href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(pick.name + ' clothing')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Search shops
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </article>
            );
          })}
          <small>
            Search shops opens an external shopping search. Listings, prices and availability are
            not verified here. Closet styling opens Blind Fit; AI runs only when you choose it.
          </small>
        </>
      )}
    </section>
  );
}
