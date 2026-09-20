import { Prisma } from '@prisma/client';
import { feedbackReasons, type LearningAgent } from '@/lib/agent-learning';
import { z } from 'zod';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await readJson(
      request,
      z
        .object({
          id: z.string().min(1).max(80),
          feedback: z.enum(['helpful', 'not-helpful']).nullable(),
          reason: z.string().max(40).nullable().optional(),
          remember: z.boolean().optional(),
        })
        .strict(),
    );
    await rateLimit(`feedback:${user.id}`, 30, 3600);
    const record = await db.agentRequest.findFirst({
      where: { id: input.id, userId: user.id },
      select: { result: true, agent: true },
    });
    if (!record?.result) throw new ApiError(404, 'Completed suggestion not found.');
    if (
      input.reason &&
      (!Object.hasOwn(feedbackReasons, record.agent) ||
        !Object.hasOwn(feedbackReasons[record.agent as LearningAgent], input.reason))
    )
      throw new ApiError(400, 'Choose a feedback reason for this agent.');
    const changed = await db.agentRequest.updateMany({
      where: { id: input.id, userId: user.id },
      data: {
        feedback: input.feedback,
        feedbackAt: input.feedback ? new Date() : null,
        feedbackDetails: input.feedback
          ? { reason: input.reason ?? null, remember: input.remember === true }
          : Prisma.DbNull,
      },
    });
    if (!changed.count) throw new ApiError(404, 'Suggestion not found.');
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
