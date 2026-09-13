import LegalPolicy from '@/components/LegalPolicy';
export const metadata = { title: 'Terms — FitStalker', alternates: { canonical: '/terms' } };
export default function TermsPage() {
  return <LegalPolicy policy="terms" />;
}
