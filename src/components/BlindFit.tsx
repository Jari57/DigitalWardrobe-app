'use client';
import AgentFeedback from './AgentFeedback';
import { useState } from 'react';
import { Lock, Unlock, Shuffle, Sparkles } from 'lucide-react';
import type { Garment, Piece } from '@/lib/types';
import { Modal, categories, api } from './ui';
import { arrange } from './OutfitCanvas';

type Recommendation = {
  id?: string;
  garmentIds: string[];
  explanation: string;
  limitations: string[];
};
export default function BlindFit({
  garments,
  onClose,
  onUse,
  initialAesthetic = 'Minimal',
  initialLockedId,
  onSaved,
  onAdd,
}: {
  garments: Garment[];
  onClose: () => void;
  onUse: (pieces: Piece[]) => void;
  initialAesthetic?: string;
  initialLockedId?: string;
  onSaved?: () => Promise<void>;
  onAdd?: () => void;
}) {
  const [chosen, setChosen] = useState<Garment[]>(() =>
    garments.filter((g) => g.id === initialLockedId),
  );
  const [locks, setLocks] = useState<string[]>(() =>
    garments.filter((g) => g.id === initialLockedId).map((g) => g.id),
  );
  const [occasion, setOccasion] = useState('Everyday');
  const [aesthetic, setAesthetic] = useState(initialAesthetic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
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
      setSaved(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Put a fit together"
      dark
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <div className="blind-intro">
          <span className="eyebrow">YOUR CLOSET. YOUR PLANS.</span>
          <h3>What are you dressing for?</h3>
          <p>Tell us your plans. Get a look from pieces you own, then save it here.</p>
        </div>
        {!garments.length ? (
          <div className="stack">
            <p>Add a few pieces so your recommendations come from your own closet.</p>
            {onAdd && (
              <button className="primary" onClick={onAdd}>
                Add a piece
              </button>
            )}
          </div>
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
                    setSaved(false);
                  }}
                >
                  <img src={item.imageUrl} alt={item.name} />
                  <span>{item.name}</span>
                  {locks.includes(item.id) ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
              ))}
            </div>
            <fieldset className="stack">
              <legend>Your plans</legend>
              <div className="form-grid">
                <label>
                  Occasion
                  <input
                    value={occasion}
                    list="style-occasions"
                    maxLength={120}
                    placeholder="Client meeting, then dinner. Comfortable shoes."
                    disabled={busy}
                    onChange={(event) => {
                      setOccasion(event.target.value);
                      setRecommendation(null);
                    }}
                  />
                  <datalist id="style-occasions">
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
                  </datalist>
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
              <button className="fuchsia" disabled={busy || !occasion.trim()} onClick={style}>
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
                {recommendation.id && <AgentFeedback id={recommendation.id} agent="stylist" />}
                <p>{recommendation.explanation}</p>
                {recommendation.limitations.map((note, index) => (
                  <small key={index}>{note}</small>
                ))}
              </div>
            )}
            {chosen.length > 0 && (
              <div className="stack">
                <button
                  className="primary"
                  disabled={busy || saved}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await api('/api/outfits', 'POST', {
                        name: `${occasion.trim() || 'Everyday'} fit`.slice(0, 100),
                        pieces: arrange(chosen),
                      });
                      setSaved(true);
                      await onSaved?.();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {saved ? 'Saved to My fits' : 'Save this fit'}
                </button>
                <button disabled={busy} onClick={() => onUse(arrange(chosen))}>
                  Edit on canvas
                </button>
              </div>
            )}
            <button className="text-button" disabled={busy} onClick={shuffle}>
              <Shuffle size={16} />
              {chosen.length ? 'Shuffle unlocked pieces' : 'Surprise me without AI'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
