'use client';
import { useState } from 'react';
import { Lock, Unlock, Shuffle, Sparkles } from 'lucide-react';
import type { Garment, Piece } from '@/lib/types';
import { Modal, categories, api } from './ui';
import { arrange } from './OutfitCanvas';

type Recommendation = { garmentIds: string[]; explanation: string; limitations: string[] };
export default function BlindFit({
  garments,
  onClose,
  onUse,
  initialAesthetic = 'Minimal',
}: {
  garments: Garment[];
  onClose: () => void;
  onUse: (pieces: Piece[]) => void;
  initialAesthetic?: string;
}) {
  const [chosen, setChosen] = useState<Garment[]>([]);
  const [locks, setLocks] = useState<string[]>([]);
  const [occasion, setOccasion] = useState('Everyday');
  const [aesthetic, setAesthetic] = useState(initialAesthetic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  function shuffle() {
    const result = chosen.filter((item) => locks.includes(item.id));
    const hasDress = result.some((item) => item.category === 'dresses');
    for (const category of categories.filter((category) => category !== 'dresses')) {
      if (
        result.some((item) => item.category === category) ||
        (hasDress && ['tops', 'bottoms'].includes(category))
      )
        continue;
      const pool = garments.filter((item) => item.category === category);
      if (pool.length) result.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    if (!result.some((item) => ['tops', 'bottoms', 'dresses'].includes(item.category))) {
      const dresses = garments.filter((item) => item.category === 'dresses');
      if (dresses.length) result.unshift(dresses[Math.floor(Math.random() * dresses.length)]);
    }
    setChosen(result);
    setRecommendation(null);
    setError('');
  }

  async function style() {
    setBusy(true);
    setError('');
    try {
      // Balance the bounded candidate pool across categories and always include locks.
      const pool = garments.filter((item) => locks.includes(item.id));
      const groups = categories.map((category) =>
        garments.filter((item) => item.category === category && !locks.includes(item.id)),
      );
      for (let index = 0; pool.length < Math.min(40, garments.length); index++) {
        for (const group of groups) if (group[index] && pool.length < 40) pool.push(group[index]);
      }
      const result = await api<Recommendation>('/api/stylist', 'POST', {
        agent: 'stylist',
        candidateIds: pool.map((item) => item.id),
        lockedIds: locks,
        occasion,
        aesthetic,
      });
      const selected = result.garmentIds.map((id) => garments.find((item) => item.id === id));
      if (selected.some((item) => !item) || locks.some((id) => !result.garmentIds.includes(id)))
        throw new Error('Your closet changed. Refresh and try again.');
      setChosen(selected as Garment[]);
      setRecommendation(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Blind Fit Challenge"
      dark
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <div className="blind-intro">
          <span className="eyebrow">LET YOUR CLOSET COOK</span>
          <h3>
            A little surprise.
            <br />A little styling instinct.
          </h3>
          <p>
            Reveal a random look or let AI style your saved pieces. Lock your favorites to keep them
            in the outfit.
          </p>
        </div>
        {!garments.length ? (
          <p>Add pieces to your closet to start the challenge.</p>
        ) : (
          <>
            <div className="blind-grid">
              {chosen.map((item) => (
                <button
                  disabled={busy}
                  aria-pressed={locks.includes(item.id)}
                  key={item.id}
                  className={locks.includes(item.id) ? 'locked' : ''}
                  onClick={() => {
                    setLocks((previous) =>
                      previous.includes(item.id)
                        ? previous.filter((id) => id !== item.id)
                        : [...previous, item.id],
                    );
                    setRecommendation(null);
                  }}
                >
                  <img src={item.imageUrl} alt={item.name} />
                  <span>{item.name}</span>
                  {locks.includes(item.id) ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
              ))}
            </div>
            <button className="fuchsia" disabled={busy} onClick={shuffle}>
              <Shuffle size={18} />
              {chosen.length ? 'Shuffle unlocked pieces' : 'Reveal my fit'}
            </button>
            <fieldset className="stack">
              <legend>AI stylist</legend>
              <div className="form-grid">
                <label>
                  Occasion
                  <select
                    value={occasion}
                    disabled={busy}
                    onChange={(event) => {
                      setOccasion(event.target.value);
                      setRecommendation(null);
                    }}
                  >
                    {[
                      'Everyday',
                      'Work',
                      'Date night',
                      'Weekend brunch',
                      'Content shoot',
                      'Evening out',
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Style
                  <select
                    value={aesthetic}
                    disabled={busy}
                    onChange={(event) => {
                      setAesthetic(event.target.value);
                      setRecommendation(null);
                    }}
                  >
                    {[
                      ...new Set([
                        initialAesthetic,
                        'Minimal',
                        'Streetwear',
                        'Classic',
                        'Bold',
                        'Soft and relaxed',
                      ]),
                    ].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              </div>
              <small>
                Uses saved names, categories and colors—not photo analysis. Up to 40 pieces per
                suggestion; locked pieces are always included. Uses your daily AI allowance.
              </small>
              <button className="fuchsia" disabled={busy} onClick={style}>
                <Sparkles size={18} />
                {busy ? 'Styling your pieces…' : 'Style with AI'}
              </button>
            </fieldset>
            {busy && <p role="status">Finding a combination for your occasion…</p>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {recommendation && (
              <div className="stack" role="status">
                <strong>Why this works</strong>
                <p>{recommendation.explanation}</p>
                {recommendation.limitations.map((note, index) => (
                  <small key={index}>{note}</small>
                ))}
              </div>
            )}
            {chosen.length > 0 && (
              <button disabled={busy} onClick={() => onUse(arrange(chosen))}>
                Style this on canvas
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
