import { legalCopy } from '@/lib/legal-copy';
export default function LegalPolicy({ policy }: { policy: keyof typeof legalCopy }) {
  return (
    <main className="legal-page">
      <a href="/">← Back to FitStalker</a>
      <h1>{policy === 'privacy' ? 'Privacy notice' : 'Terms of use'}</h1>
      <p>FitStalker · Updated September 13, 2026</p>
      <p>
        Contact: <a href="mailto:support@fitstalker.com">support@fitstalker.com</a>
      </p>
      {legalCopy[policy]
        .split(/\n\n+/)
        .map((block, index) =>
          block.startsWith('## ') ? (
            <h2 key={index}>{block.slice(3)}</h2>
          ) : (
            <p key={index}>{block}</p>
          ),
        )}
      <p>
        <a href="/cookies">Cookies and device storage</a>
      </p>
    </main>
  );
}
