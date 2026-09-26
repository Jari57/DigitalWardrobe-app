import Link from 'next/link';
import { Camera, Sparkles, Shirt, Layers, ArrowRight } from 'lucide-react';
import { sectionGuides } from '@/lib/section-guides';
import './guide.css';
export const metadata = {
  title: 'How FitStalker works',
  description:
    'A short guide to finding clothes, discovering inspiration and styling your own closet.',
  alternates: { canonical: '/how-it-works' },
};
const icons = [Camera, Sparkles, Shirt, Layers];
export default function HowItWorksPage() {
  return (
    <main className="style-guide">
      <header className="guide-top">
        <Link href="/">FitStalker</Link>
        <Link href="/">
          Back to the app <ArrowRight size={16} />
        </Link>
      </header>
      <section className="guide-hero">
        <div>
          <p className="eyebrow">THE FITSTALKER FIELD GUIDE</p>
          <h1>
            Your style.
            <br />
            <em>A little easier.</em>
          </h1>
          <p>Find a piece you spotted. Discover a new idea. Put your own clothes to work.</p>
          <nav aria-label="Guide sections">
            {sectionGuides.map((guide) => (
              <a key={guide.id} href={`#${guide.id}`}>
                {guide.title}
              </a>
            ))}
          </nav>
        </div>
        <figure>
          <img
            src="/brand/street-style-editorial.webp"
            alt="Two street-style outfits: a brown blazer with jeans and an ivory polo with charcoal trousers"
            width={1536}
            height={1024}
          />
          <figcaption>One look can be the start of something yours.</figcaption>
        </figure>
      </section>
      <div className="guide-sections">
        {sectionGuides.map((guide, index) => {
          const Icon = icons[index];
          return (
            <section
              className="guide-section"
              id={guide.id}
              key={guide.id}
              aria-labelledby={`${guide.id}-title`}
            >
              <div className="guide-example">
                <Icon size={38} aria-hidden="true" />
                <span className="eyebrow">
                  0{index + 1} / {guide.title}
                </span>
                <h2 id={`${guide.id}-title`}>{guide.purpose}</h2>
                <p>{guide.example}</p>
              </div>
              <div className="guide-instructions">
                <ol>
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="guide-tip">
                  <strong>A little tip</strong>
                  {guide.tip}
                </p>
              </div>
            </section>
          );
        })}
      </div>
      <footer className="guide-bottom">
        <p>Ready to find your next fit?</p>
        <Link href="/">
          Open FitStalker <ArrowRight size={18} />
        </Link>
      </footer>
    </main>
  );
}
