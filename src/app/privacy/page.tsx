import LegalPolicy from '@/components/LegalPolicy';
export const metadata = { title: 'Privacy — FitStalker', alternates: { canonical: '/privacy' } };
export default function PrivacyPage() {
  return <LegalPolicy policy="privacy" />;
}
