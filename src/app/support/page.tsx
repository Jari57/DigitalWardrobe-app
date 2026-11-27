import Link from 'next/link';

export const metadata = {
  title: 'Support — FitStalker',
  alternates: { canonical: '/support' },
};

export default function SupportPage() {
  return (
    <main className="legal-page">
      <Link href="/">← Back to FitStalker</Link>
      <h1>FitStalker support</h1>
      <p>
        For help with your closet, photos, or account, email{' '}
        <a href="mailto:support@fitstalker.com">support@fitstalker.com</a>.
      </p>
      <h2>Recover or delete your account</h2>
      <p>
        Choose Forgot password on the sign-in screen and enter your recovery code. To delete your
        account and saved photos, open Account and choose Delete account. If you cannot sign in,
        contact support.
      </p>
      <Link href="/privacy">Privacy notice</Link>
    </main>
  );
}
