'use client';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, X } from 'lucide-react';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null),
    [offline, setOffline] = useState(false),
    [waiting, setWaiting] = useState<ServiceWorker | null>(null),
    [help, setHelp] = useState(false),
    [installed, setInstalled] = useState(false);
  useEffect(() => {
    const network = () => setOffline(!navigator.onLine);
    network();
    setInstalled(
      matchMedia('(display-mode: standalone)').matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone,
    );
    const install = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setPrompt(null);
      setInstalled(true);
    };
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', done);
    let active = true;
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (active && reg.waiting) setWaiting(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (active && worker.state === 'installed' && navigator.serviceWorker.controller)
                setWaiting(worker);
            });
          });
        })
        .catch(() => {
          /* Installation is optional; the online app stays usable. */
        });
    return () => {
      active = false;
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  return (
    <div className="install-app">
      {offline && (
        <p role="status" className="note">
          You’re offline. Reconnect before saving or using AI. Keep this page open to preserve
          unsaved edits.
        </p>
      )}
      {waiting && (
        <div className="note">
          <p>An app update is ready. Save your work before reloading.</p>
          <button
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => location.reload(),
                { once: true },
              );
              waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
            }}
          >
            Reload for update
          </button>
        </div>
      )}
      {!installed && (
        <section className="install-card" aria-label="Install FitStalker">
          <img
            className="install-brand-icon"
            src="/icons/icon-192.png"
            width="48"
            height="48"
            alt=""
          />
          <div className="install-copy">
            <strong>Your next fit. One tap away.</strong>
            <p>Add FitStalker to your home screen.</p>
          </div>
          <button
            className="install-action"
            onClick={async () => {
              if (prompt) {
                try {
                  await prompt.prompt();
                  await prompt.userChoice;
                } catch {
                  setHelp(true);
                } finally {
                  setPrompt(null);
                }
              } else setHelp(!help);
            }}
          >
            <ArrowDownToLine size={16} aria-hidden="true" />
            Install FitStalker
          </button>
          {help && (
            <div className="install-help">
              <div>
                <strong>Make it a home-screen favorite</strong>
                <p>
                  <b>iPhone or iPad:</b> In Safari, tap Share, then Add to Home Screen.
                </p>
                <p>
                  <b>Android or desktop:</b> Open the browser menu and choose Install app or Add to
                  Home screen, when available.
                </p>
              </div>
              <button
                className="install-help-close"
                aria-label="Close install instructions"
                onClick={() => setHelp(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
