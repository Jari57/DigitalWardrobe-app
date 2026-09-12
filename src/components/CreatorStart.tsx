"use client";
import { useState } from 'react';
import { ArrowRight, Camera, Sparkles, Clapperboard } from 'lucide-react';

export default function CreatorStart({ garmentCount, hasComposition, aesthetic, onAesthetic, onImport, onStyle, onCanvas }: {
  garmentCount: number; hasComposition: boolean; aesthetic: string;
  onAesthetic: (value: string) => void; onImport: () => void; onStyle: () => void; onCanvas: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return <button className="text-button creator-reopen" onClick={() => setDismissed(false)}>Creator quick start</button>;
  const step = !garmentCount ? 0 : !hasComposition ? 1 : 2;
  const steps = [
    { icon: Camera, title: 'Your clothes. Your main character moment.', text: 'Start with a real photo of a favorite piece. You can ask AI to suggest its details, then review everything before saving.', action: 'Add my first photo', run: onImport },
    { icon: Sparkles, title: 'Turn your closet into a fit.', text: 'Try Blind Fit, lock a favorite and ask the stylist for a combination. A top, bottoms and shoes give it more to work with.', action: 'Try my first Blind Fit', run: onStyle },
    { icon: Clapperboard, title: 'Make it your next GRWM.', text: 'Arrange your outfit, save the look and export a vertical PNG. Choose where to share it from your phone.', action: 'Finish my outfit card', run: onCanvas },
  ];
  const current = steps[step], Icon = current.icon;
  return <section className="creator-start stack" aria-label="Creator quick start">
    <div className="row between"><span className="eyebrow">YOUR FIRST FIT · {step + 1} / 3</span><button className="text-button" onClick={() => setDismissed(true)}>Skip for now</button></div>
    <div className="creator-steps" aria-label={`Step ${step + 1} of 3`}>{steps.map((item, index) => <span key={item.action} className={index <= step ? 'active' : ''}/>)}</div>
    <Icon size={28} strokeWidth={1.5}/><h2>{current.title}</h2><p>{current.text}</p>
    {step < 2 && <fieldset><legend>Pick your vibe</legend><div className="row wrap">{['Minimal', 'Streetwear', 'Classic', 'Bold', 'Soft and relaxed'].map(value => <button key={value} className="vibe-chip" aria-pressed={aesthetic === value} onClick={() => onAesthetic(value)}>{value}</button>)}</div><small>You can change this for every outfit.</small></fieldset>}
    <button className="primary" onClick={current.run}>{current.action}<ArrowRight size={17}/></button>
  </section>;
}
