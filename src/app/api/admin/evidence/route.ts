import { requireUser, rateLimit } from '@/server/auth';
import { ApiError, handleError } from '@/server/http';
import { investorEvidence } from '@/server/investor-evidence';
export async function GET() {
  try {
    const user = await requireUser();
    if (!user.isAdmin) throw new ApiError(403, 'Administrator access required.');
    await rateLimit(`investor-export:${user.id}`, 12, 60);
    const report = await investorEvidence();
    return new Response(JSON.stringify(report, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="fitstalker-evidence-${report.generatedAt.slice(0, 10)}.json"`,
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
