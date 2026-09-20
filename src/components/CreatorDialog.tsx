'use client';
import AgentFeedback from './AgentFeedback';
import { useState } from 'react';
import type { Garment, Outfit } from '@/lib/types';
import { Modal, api } from './ui';
import ExportActions from './ExportActions';
type Draft = {
  groundingNote?: string;
  id: string;
  caption: string;
  filmingSteps: string[];
  feedback: 'helpful' | 'not-helpful' | null;
};
export default function CreatorDialog({
  outfit,
  garments,
  onClose,
}: {
  outfit: Outfit;
  garments: Garment[];
  onClose: () => void;
}) {
  const [tone, setTone] = useState('playful'),
    [caption, setCaption] = useState(''),
    [steps, setSteps] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  async function generate() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<Draft>('/api/creator', 'POST', {
        agent: 'creator',
        outfitId: outfit.id,
        tone,
      });
      setDraft(result);
      setCaption(result.caption);
      setSteps(result.filmingSteps);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function feedback(value: Draft['feedback']) {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/agent-feedback', 'POST', { id: draft.id, feedback: value });
      setDraft({ ...draft, feedback: value });
      setMessage(value ? 'Feedback saved.' : 'Feedback removed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Make content from your look"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <h3>{outfit.name}</h3>
        <p>Write your own caption, or let AI draft one with filming steps from this saved look.</p>
        <label>
          Tone
          <select disabled={busy} value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="playful">Playful</option>
            <option value="minimal">Minimal</option>
            <option value="confident">Confident</option>
          </select>
        </label>
        <small>
          Sends saved outfit and garment descriptions to our AI provider. Uses your shared daily
          allowance. Generating replaces these draft edits; nothing posts automatically.
        </small>
        <button className="primary" disabled={busy} onClick={generate}>
          {busy ? 'Working…' : 'Draft with AI'}
        </button>
        <label>
          Creator caption
          <textarea
            maxLength={160}
            value={caption}
            disabled={busy}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
        <small>{caption.length}/160 · Copy or export before closing; edits are not saved.</small>
        {steps.map((step, index) => (
          <label key={index}>
            Filming step {index + 1}
            <textarea
              maxLength={240}
              disabled={busy}
              value={step}
              onChange={(e) =>
                setSteps((previous) =>
                  previous.map((value, i) => (i === index ? e.target.value : value)),
                )
              }
            />
          </label>
        ))}
        <button
          disabled={busy || !caption.trim()}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                [caption, ...steps.map((step, i) => `${i + 1}. ${step}`)].join('\n\n'),
              );
              setMessage('Caption and filming steps copied.');
            } catch {
              setError('Copy is unavailable. Select and copy the text fields.');
            }
          }}
        >
          Copy content
        </button>
        <ExportActions
          garments={garments}
          pieces={outfit.pieces}
          caption={caption}
          disabled={busy || !caption.trim()}
        />
        {draft && (
          <div className="row wrap" aria-label="Suggestion feedback">
            <button
              disabled={busy}
              aria-pressed={draft.feedback === 'helpful'}
              onClick={() => feedback(draft.feedback === 'helpful' ? null : 'helpful')}
            >
              Helpful
            </button>
            <button
              disabled={busy}
              aria-pressed={draft.feedback === 'not-helpful'}
              onClick={() => feedback(draft.feedback === 'not-helpful' ? null : 'not-helpful')}
            >
              Not helpful
            </button>
            <small>Rates the original AI draft. Feedback is deleted with your account.</small>
          </div>
        )}
        {draft && <AgentFeedback id={draft.id} agent="creator" />}
        {draft?.groundingNote && <small>{draft.groundingNote}</small>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </Modal>
  );
}
