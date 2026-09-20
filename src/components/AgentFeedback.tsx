'use client';
import { useEffect, useState } from 'react';
import { feedbackReasons, type LearningAgent } from '@/lib/agent-learning';
import { api } from './ui';
export default function AgentFeedback({ id, agent }: { id: string; agent: LearningAgent }) {
  const [rating, setRating] = useState<'helpful' | 'not-helpful'>('not-helpful');
  const [reason, setReason] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    setReason('');
    setMessage('');
  }, [id]);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await api('/api/agent-feedback', 'POST', {
        id,
        feedback: rating,
        reason: rating === 'not-helpful' ? reason || null : null,
        remember,
      });
      setMessage(
        remember
          ? 'Saved. Future suggestions can use this feedback.'
          : 'Rating saved without updating your preferences.',
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="agent-feedback">
      <summary>Help this agent improve for you</summary>
      <div className="stack">
        <label>
          Was this useful?
          <select
            aria-label="Was this useful?"
            value={rating}
            disabled={busy}
            onChange={(e) => setRating(e.target.value as typeof rating)}
          >
            <option value="helpful">Helpful</option>
            <option value="not-helpful">Needs improvement</option>
          </select>
        </label>
        {rating === 'not-helpful' && (
          <label>
            What should change?
            <select
              aria-label="What should change?"
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Choose a reason</option>
              {Object.entries(feedbackReasons[agent]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="feedback-remember">
          <input
            type="checkbox"
            checked={remember}
            disabled={busy}
            onChange={(e) => setRemember(e.target.checked)}
          />{' '}
          Use this feedback in my future suggestions
        </label>
        <small>
          Private to your account. Inspect or reset learned preferences in Account settings. This
          does not train the underlying AI model.
        </small>
        <button disabled={busy || (rating === 'not-helpful' && !reason)} onClick={save}>
          {busy ? 'Saving...' : 'Save agent feedback'}
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    </details>
  );
}
