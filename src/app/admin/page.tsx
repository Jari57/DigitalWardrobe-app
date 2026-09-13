import { notFound, redirect } from 'next/navigation';
import { sessionUser } from '@/server/auth';
import { db } from '@/server/db';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const user = await sessionUser();
  if (!user) redirect('/login');
  if (!user.isAdmin) notFound();
  const [users, garments, outfits, incomplete] = await Promise.all([
    db.user.count(),
    db.garment.count(),
    db.outfit.count(),
    db.agentRequest.count({ where: { state: { in: ['uncertain', 'dispatched'] } } }),
  ]);
  return (
    <main className="app-shell main-content">
      <div className="stack">
        <a href="/">Back to wardrobe</a>
        <h1>Administration</h1>
        <p>Signed in with your verified administrator Google account.</p>
        <dl>
          <dt>Accounts</dt>
          <dd>{users}</dd>
          <dt>Closet pieces</dt>
          <dd>{garments}</dd>
          <dt>Saved looks</dt>
          <dd>{outfits}</dd>
          <dt>AI requests awaiting settlement</dt>
          <dd>{incomplete}</dd>
        </dl>
        <p>Billing is off. Stripe has not been connected.</p>
      </div>
    </main>
  );
}
