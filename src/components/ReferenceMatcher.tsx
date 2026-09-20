'use client';
import AgentFeedback from './AgentFeedback';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Garment, Piece, Reference } from '@/lib/types';
import { api, categories, Modal } from './ui';
import { arrange } from './OutfitCanvas';
type Proposal = {
  id?: string;
  elements: { description: string; garmentId: string | null; explanation: string }[];
  limitations: string[];
};

export default function ReferenceMatcher({
  reference,
  garments,
  onClose,
  onRefresh,
  onUse,
  onShop,
}: {
  reference: Reference;
  garments: Garment[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onUse: (pieces: Piece[]) => void;
  onShop: (imageUrl: string) => void;
}) {
  const [selected, setSelected] = useState(
    reference.garmentIds.filter((id) => garments.some((g) => g.id === id)),
  );
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function match() {
    setBusy(true);
    setError('');
    try {
      const groups = categories.map((category) => garments.filter((g) => g.category === category));
      const candidates: Garment[] = [];
      for (let i = 0; i < garments.length && candidates.length < 40; i++) {
        for (const group of groups)
          if (group[i] && candidates.length < 40) candidates.push(group[i]);
      }
      const result = await api<Proposal>('/api/spotter', 'POST', {
        agent: 'spotter',
        imageId: reference.imageUrl.split('/').pop(),
        candidateIds: candidates.map((g) => g.id),
      });
      const ids = result.elements.flatMap((e) => (e.garmentId ? [e.garmentId] : []));
      if (ids.some((id) => !garments.some((g) => g.id === id)))
        throw new Error('Your closet changed. Refresh and try again.');
      setProposal(result);
      setSelected([...new Set(ids)]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(canvas: boolean) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/references/${reference.id}`, 'PATCH', { garmentIds: selected });
      await onRefresh();
      if (canvas) onUse(arrange(selected.map((id) => garments.find((g) => g.id === id)!)));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Recreate your inspiration"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <img className="discovery-photo" src={reference.imageUrl} alt={reference.name} />
        <p>Find substitutes in your own closet, then choose which pieces to keep.</p>
        <small>
          AI matching sends this inspiration photo and up to 40 saved garment descriptions to our
          provider. It uses names, categories, colors and up to 12 owned photos for your closet
          pieces. Uses your daily AI allowance.
        </small>
        <button className="primary" disabled={busy} onClick={match}>
          <Sparkles size={18} />
          {busy ? 'Working…' : 'Match my closet with AI'}
        </button>
        {proposal && (
          <section className="stack" aria-label="Suggested closet matches">
            {!proposal.elements.length && (
              <p>No clothing was identified. Try a clearer inspiration photo.</p>
            )}
            {proposal.elements.map((element, i) => (
              <article className="discovery-item" key={i}>
                <span className="eyebrow">
                  {element.garmentId ? 'Owned substitute' : 'No suitable owned match'}
                </span>
                <h3>{element.description}</h3>
                {element.garmentId && (
                  <strong>{garments.find((g) => g.id === element.garmentId)?.name}</strong>
                )}
                <p>{element.explanation}</p>
              </article>
            ))}
            {proposal.id && <AgentFeedback id={proposal.id} agent="spotter" />}
            {proposal.limitations.map((note, i) => (
              <small key={i}>{note}</small>
            ))}
            {proposal.elements.some((e) => !e.garmentId) && (
              <button
                disabled={busy}
                onClick={() => {
                  onShop(reference.imageUrl);
                  onClose();
                }}
              >
                Find missing pieces to buy
              </button>
            )}
          </section>
        )}
        <fieldset>
          <legend>Your final pieces · {selected.length} selected</legend>
          <p>
            Edit these selections before saving. AI suggestions remain a draft until you accept.
          </p>
          <div className="checklist">
            {garments.map((g) => (
              <label key={g.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(g.id)}
                  disabled={busy || (!selected.includes(g.id) && selected.length >= 30)}
                  onChange={() =>
                    setSelected((previous) =>
                      previous.includes(g.id)
                        ? previous.filter((id) => id !== g.id)
                        : [...previous, g.id],
                    )
                  }
                />
                <img src={g.imageUrl} alt="" />
                {g.name}
              </label>
            ))}
          </div>
          {!garments.length && <p>Your closet is empty. Add your own pieces to make a match.</p>}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} onClick={() => save(false)}>
          Save pairings
        </button>
        <button
          className="primary"
          disabled={busy || !selected.length || selected.length > 12}
          onClick={() => save(true)}
        >
          Save and style on canvas
        </button>
        {selected.length > 12 && <small>Choose up to 12 pieces to fit on the canvas.</small>}
      </div>
    </Modal>
  );
}
