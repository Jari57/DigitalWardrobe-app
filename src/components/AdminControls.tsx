'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ServiceControl } from '@/server/service-control';
export default function AdminControls({
  control,
  ceiling,
  minimum,
  userCeiling,
}: {
  control: ServiceControl;
  ceiling: number;
  minimum: number;
  userCeiling: number;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(control.aiPaused);
  const [cap, setCap] = useState(String((control.dailyCapMicros ?? ceiling) / 1e6));
  const [limit, setLimit] = useState(String(control.requestsPerUser ?? userCeiling));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <form
      className="admin-controls"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setStatus('');
        try {
          const response = await fetch('/api/admin/controls', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              aiPaused: paused,
              dailyCapMicros: Math.round(Number(cap) * 1e6),
              requestsPerUser: Number(limit),
              version: control.version,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? 'Could not save controls.');
          setStatus('Saved. New AI requests use these limits.');
          router.refresh();
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Could not save.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="admin-switch">
        <input
          type="checkbox"
          checked={paused}
          onChange={(e) => setPaused(e.target.checked)}
          disabled={busy}
        />{' '}
        Pause new AI requests
      </label>
      <label>
        Daily AI ceiling (USD)
        <input
          type="number"
          required
          min={minimum / 1e6}
          max={ceiling / 1e6}
          step="0.000001"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          disabled={busy}
        />
      </label>
      <label>
        Daily actions per account
        <input
          type="number"
          required
          min="1"
          max={userCeiling}
          step="1"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          disabled={busy}
        />
      </label>
      <p>
        Limits stay within the deployment ceilings. Requests already in flight may finish. Resuming
        AI does not enable billing.
      </p>
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save controls'}
      </button>
      <p role="status">{status}</p>
    </form>
  );
}
