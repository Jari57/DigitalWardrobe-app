'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';
import {
  defaultShoppingPreferences,
  type ShoppingPreferences as Preferences,
} from '@/lib/experience';
export default function ShoppingPreferences() {
  const [value, setValue] = useState<Preferences>(defaultShoppingPreferences);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    api<{ preferences: Preferences }>('/api/experience')
      .then((r) => {
        if (active) {
          setValue(r.preferences);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setMessage('Preferences could not load. Close and reopen settings to try again.');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <details className="preference-panel">
      <summary>Shopping preferences</summary>
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            await api('/api/experience', 'PATCH', { kind: 'preferences', preferences: value });
            setMessage('Preferences saved. New searches use these defaults.');
            window.dispatchEvent(new Event('shopping-preferences-updated'));
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          A few details to make discovery more useful. All are optional; you can change them
          anytime.
        </p>
        <label>
          Shopping region
          <select
            disabled={!ready || busy}
            value={value.region}
            onChange={(e) =>
              setValue({ ...value, region: e.target.value as Preferences['region'] })
            }
          >
            {[
              ['US', 'United States'],
              ['GB', 'United Kingdom'],
              ['CA', 'Canada'],
              ['AU', 'Australia'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <label>
            Budget per piece
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              placeholder="No limit"
              disabled={!ready || busy}
              value={value.maxPrice ?? ''}
              onChange={(e) =>
                setValue({ ...value, maxPrice: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <label>
            Currency
            <select
              disabled={!ready || busy}
              value={value.currency}
              onChange={(e) =>
                setValue({ ...value, currency: e.target.value as Preferences['currency'] })
              }
            >
              {['USD', 'GBP', 'CAD', 'AUD'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Preferred sizes
          <input
            maxLength={80}
            placeholder="e.g. Tops M, shoes US 9"
            disabled={!ready || busy}
            value={value.sizes}
            onChange={(e) => setValue({ ...value, sizes: e.target.value })}
          />
        </label>
        <small>
          Budget and sizes guide searches. Prices, size stock and delivery still need confirmation
          with the retailer.
        </small>
        <button className="primary" disabled={!ready || busy}>
          {busy ? 'Saving…' : 'Save preferences'}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
