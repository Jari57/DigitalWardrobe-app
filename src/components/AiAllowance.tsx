'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';
type Allowance = {
  enabled: boolean;
  remaining?: number;
  limit?: number;
  sharedLimitReached?: boolean;
  resetsAt?: string;
};
export default function AiAllowance() {
  const [value, setValue] = useState<Allowance>();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => {
      api<Allowance>('/api/ai-allowance')
        .then((data) => {
          if (active) setValue(data);
        })
        .catch(() => {
          if (active) setValue(undefined);
        });
    };
    refresh();
    window.addEventListener('wardrobe-ai-used', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.removeEventListener('wardrobe-ai-used', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return value ? (
    <details className="ai-allowance">
      <summary>
        {value.enabled
          ? `AI: ${value.remaining} of ${value.limit} daily actions left`
          : 'AI is currently unavailable.'}
      </summary>
      <small>
        Resets at midnight UTC.{' '}
        {value.sharedLimitReached
          ? 'Shared service limit reached; new generations are paused. '
          : ''}
        Saved results may be reused without another action.
      </small>
      {value.enabled && (
        <>
          <button
            className="text-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMessage('');
              try {
                const result = await api<{ resolved: number; unresolved: number }>(
                  '/api/ai-recovery',
                  'POST',
                );
                window.dispatchEvent(new Event('wardrobe-ai-used'));
                setMessage(
                  `${result.resolved} completed requests reconciled. ${result.unresolved} still awaiting reliable provider evidence. No generation was repeated.`,
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Checking…' : 'Check interrupted AI requests'}
          </button>
          {message && <p role="status">{message}</p>}
        </>
      )}
    </details>
  ) : null;
}
