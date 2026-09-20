'use client';
import { useEffect, useState } from 'react';
import type { Piece } from '@/lib/types';
import { api } from './ui';
export default function StudioResume({
  onDraft,
  onSaved,
  onLooks,
}: {
  onDraft: (pieces: Piece[]) => void;
  onSaved: () => void;
  onLooks: () => void;
}) {
  const [draft, setDraft] = useState<Piece[]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      api<{ draft: Piece[] }>('/api/experience')
        .then((r) => {
          if (active) setDraft(r.draft);
        })
        .catch(() => {});
    void load();
    window.addEventListener('wardrobe-draft-updated', load);
    return () => {
      active = false;
      window.removeEventListener('wardrobe-draft-updated', load);
    };
  }, []);
  return (
    <section className="resume-studio stack" aria-label="Continue your style">
      <div>
        <span className="eyebrow">YOUR STYLE, IN PROGRESS</span>
        <h3>Pick up where you left off</h3>
      </div>
      <div className="row wrap">
        {draft.length > 0 && (
          <button className="primary" onClick={() => onDraft(draft)}>
            Resume draft · {draft.length} pieces
          </button>
        )}
        <button onClick={onSaved}>Saved inspiration</button>
        <button onClick={onLooks}>My saved looks</button>
      </div>
    </section>
  );
}
