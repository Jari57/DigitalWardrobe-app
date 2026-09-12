import { sessionUser } from '@/server/auth';
import { handleError, json } from '@/server/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return json({ user: await sessionUser() }); }
  catch (error) { return handleError(error); }
}
