import { NextResponse } from 'next/server';
import september from '@/content/trends/2026-09.json';
import { selectTrendEdition, trendEditionSchema } from '@/lib/trends';
export const dynamic = 'force-dynamic';
// Reviewed editions are persisted in Git. Reads never call AI or mutate data.
const editions = [trendEditionSchema.parse(september)];
export function GET() {
  return NextResponse.json(selectTrendEdition(editions), { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } });
}
