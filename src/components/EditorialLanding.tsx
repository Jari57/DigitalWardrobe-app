'use client';
import { useState } from 'react';
import { ArrowUpRight, ArrowRight } from 'lucide-react';

const steps = [
  {
    title: 'See a look you love.',
    description:
      'A screenshot from your feed. A photo from your camera roll. Start with the outfit that caught your eye.',
  },
  {
    title: 'Get to know the pieces.',
    description: 'Identify the shapes, colors and details. Choose the piece you want to find.',
  },
  {
    title: 'Make it your own.',
    description:
      'Look for similar pieces to shop, or put a fit together with clothes already in your closet.',
  },
];

export default function EditorialLanding({
  onStyle,
  onStalk,
}: {
  onStyle: () => void;
  onStalk: () => void;
}) {
  const [step, setStep] = useState(0);
  return (
    <>
      <section className="editorial-hero" aria-label="Your style shortcuts">
        <div className="editorial-copy">
          <span className="editorial-kicker">FITSTALKER / EVERYDAY, WELL DRESSED</span>
          <h2>
            See the fit.
            <br />
            <em>Make it yours.</em>
          </h2>
          <p>
            For the looks you screenshot.
            <br />
            And the clothes you already love.
          </p>
          <div className="editorial-actions">
            <button className="editorial-primary" onClick={onStalk}>
              <span>
                Upload screenshot<small>Find the pieces that caught your eye</small>
              </span>
              <ArrowUpRight size={20} />
            </button>
            <button className="editorial-secondary" onClick={onStyle}>
              <span>
                Put a fit together<small>From your closet, for your plans</small>
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
          <span className="editorial-footnote">Your taste. Your closet. Your next find.</span>
        </div>
        <figure className="editorial-photo">
          <img
            src="/brand/street-style-editorial.webp"
            alt="Two people in relaxed street style: a brown blazer with jeans, and an ivory polo with charcoal trousers"
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <figcaption>
            <span>THE EVERYDAY EDIT</span>
            <span>01 / STREET NOTES</span>
          </figcaption>
        </figure>
      </section>
      <details className="editorial-demo">
        <summary>
          <span>A good outfit starts with a second look.</span>
          <span>
            See how it works <ArrowRight size={16} />
          </span>
        </summary>
        <div className="demo-layout">
          <div className="demo-visual">
            <img
              src="/brand/street-style-editorial.webp"
              alt="Illustrative outfit used in the walkthrough"
              width="1536"
              height="1024"
              loading="lazy"
            />
            <span className="demo-label">ILLUSTRATIVE DEMO</span>
            {step > 0 && (
              <div className="demo-pieces">
                <span>Brown blazer</span>
                <span>Straight-leg jeans</span>
                <span>Ivory knit polo</span>
              </div>
            )}
          </div>
          <div className="demo-copy">
            <div className="demo-step-controls" role="group" aria-label="Demo steps">
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  aria-label={`Step ${index + 1}: ${item.title}`}
                  aria-pressed={step === index}
                  onClick={() => setStep(index)}
                >
                  0{index + 1}
                </button>
              ))}
            </div>
            <div aria-live="polite">
              <h3>{steps[step].title}</h3>
              <p>{steps[step].description}</p>
            </div>
            {step === 2 ? (
              <button className="editorial-primary" onClick={onStalk}>
                Try your own screenshot <ArrowUpRight size={18} />
              </button>
            ) : (
              <button className="editorial-secondary" onClick={() => setStep(step + 1)}>
                Next step <ArrowRight size={18} />
              </button>
            )}
            <small>
              Example imagery, not a live search result. Shopping finds similar pieces; exact
              matches and stock are not guaranteed.
            </small>
          </div>
        </div>
      </details>
    </>
  );
}
