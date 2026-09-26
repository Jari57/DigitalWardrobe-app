import { sectionGuides } from '@/lib/section-guides';
export default function SectionTip({ tab }: { tab: string }) {
  const guide = sectionGuides.find((entry) => entry.tab === tab);
  if (!guide) return null;
  return (
    <aside className="section-tip" aria-label={`${guide.title} tip`}>
      <span>{guide.tip}</span>
      <a
        href={`/how-it-works#${guide.id}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`How ${guide.title} works`}
      >
        How this works ↗
      </a>
    </aside>
  );
}
