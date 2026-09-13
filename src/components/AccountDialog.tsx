'use client';
import { useState } from 'react';
import { api, Modal, download } from './ui';
import { googleIdentityToken } from '@/lib/google-signin';
export default function AccountDialog({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  onAuthenticated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'recover'>('signin'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [code, setCode] = useState(''),
    [copied, setCopied] = useState(false);
  return (
    <Modal
      title={
        code
          ? 'Save your recovery code'
          : mode === 'signin'
            ? 'Welcome to FitStalker'
            : mode === 'signup'
              ? 'Make room for your style'
              : 'Recover your account'
      }
      onClose={() => {
        if (!busy && !code) onClose();
      }}
    >
      {code ? (
        <div className="stack">
          <p>
            This is your only way to reset a forgotten password. Keep it somewhere private. We
            cannot recover it for you.
          </p>
          <code className="recovery-code">{code}</code>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                setError('Clipboard unavailable. Download or select and copy your code.');
              }
            }}
          >
            {copied ? 'Copied' : 'Copy code'}
          </button>
          <button
            onClick={() =>
              download(
                new Blob([`FitStalker recovery code\n${code}\nKeep this private.`], {
                  type: 'text/plain',
                }),
                'fitstalker-recovery-code.txt',
              )
            }
          >
            Download code
          </button>
          <button className="primary" onClick={onClose}>
            I saved my code
          </button>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            try {
              const result = await api<{ recoveryCode?: string }>('/api/auth', 'POST', {
                action: mode,
                username: f.get('username'),
                password: f.get('password'),
                ...(mode === 'recover' ? { recoveryCode: f.get('recoveryCode') } : {}),
              });
              if (result.recoveryCode) setCode(result.recoveryCode);
              await onAuthenticated();
              if (!result.recoveryCode) onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>Your photos, pieces and saved looks stay in your private account.</p>
          {mode !== 'recover' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await api('/api/auth/google', 'POST', { idToken: await googleIdentityToken() });
                    await onAuthenticated();
                    onClose();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Continue with Google
              </button>
              <small>
                Already have a closet? Sign in below, then link Google in Account settings to keep
                your pieces together.
              </small>
              <p>Or use your username</p>
            </>
          )}
          <label>
            Username
            <input
              name="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
              autoComplete="username"
              placeholder="your_name"
            />
          </label>
          <small>3–32 letters, numbers or underscores.</small>
          {mode === 'recover' && (
            <label>
              Recovery code
              <input name="recoveryCode" required autoComplete="off" />
            </label>
          )}
          <label>
            {mode === 'recover' ? 'New password' : 'Password'}
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
          <small>Use at least 12 characters.</small>
          <button className="primary" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Reset password'}
          </button>
          <div className="row wrap">
            {(['signin', 'signup', 'recover'] as const)
              .filter((m) => m !== mode)
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setMode(m);
                    setError('');
                  }}
                >
                  {m === 'signin'
                    ? 'Sign in'
                    : m === 'signup'
                      ? 'Create account'
                      : 'Forgot password?'}
                </button>
              ))}
          </div>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <a className="text-button" href="/cookies" target="_blank" rel="noopener noreferrer">
        Cookies &amp; device storage
      </a>
      <p className="note">
        Review our{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer">
          Terms
        </a>{' '}
        and{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy notice
        </a>
        .
      </p>
    </Modal>
  );
}
