'use client';

import { useState } from 'react';
import type { User } from '@/lib/types';
import { api, Modal } from './ui';

export default function AccountSettings({
  user,
  onClose,
  onSignedOut,
}: {
  user: User;
  onClose: () => void;
  onSignedOut: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Account settings"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <p>
          Signed in as <strong>@{user.username}</strong>. Your photos and saved looks are private.
        </p>
        {deleting ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(async () => {
                await api('/api/account', 'DELETE', { password: form.get('password') });
                onSignedOut();
              });
            }}
          >
            <h3>Delete your account permanently?</h3>
            <p>
              This removes your photos, wardrobe, saved looks, inspiration and wear history. This
              cannot be undone.
            </p>
            <label>
              Confirm your password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
              />
            </label>
            <label className="delete-confirmation">
              <input type="checkbox" required disabled={busy} />I understand that all my data will
              be deleted.
            </label>
            <button className="danger" disabled={busy}>
              Permanently delete account
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDeleting(false);
                setError('');
              }}
            >
              Keep my account
            </button>
          </form>
        ) : (
          <>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                const element = event.currentTarget;
                const form = new FormData(element);
                void run(async () => {
                  if (form.get('newPassword') !== form.get('repeatPassword'))
                    throw new Error('New passwords must match.');
                  await api('/api/account', 'PATCH', {
                    password: form.get('password'),
                    newPassword: form.get('newPassword'),
                  });
                  element.reset();
                  setMessage(
                    'Password updated. Other sessions have been signed out. Your recovery code still works.',
                  );
                });
              }}
            >
              <h3>Change password</h3>
              <label>
                Current password
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  disabled={busy}
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                />
              </label>
              <label>
                Repeat new password
                <input
                  type="password"
                  name="repeatPassword"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                />
              </label>
              <button className="primary" disabled={busy}>
                Update password
              </button>
            </form>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api('/api/auth', 'POST', { action: 'signout' });
                  onSignedOut();
                })
              }
            >
              Sign out
            </button>
            <button
              className="text-button danger"
              disabled={busy}
              onClick={() => {
                setDeleting(true);
                setError('');
                setMessage('');
              }}
            >
              Delete my account
            </button>
          </>
        )}
        {busy && <p role="status">Updating your account…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
      </div>
    </Modal>
  );
}
