import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, readJson, json, handleError, ApiError } from '@/server/http';
import { configuredAgentBudget } from '@/server/agents/ledger';
import type { ServiceControl } from '@/server/service-control';

const schema = z
  .object({
    aiPaused: z.boolean(),
    dailyCapMicros: z.number().int().positive().nullable(),
    requestsPerUser: z.number().int().min(1).max(100).nullable(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    if (!user.isAdmin) throw new ApiError(403, 'Administrator access required.');
    await rateLimit(`admin-control:${user.id}`, 20, 60);
    const input = await readJson(request, schema);
    const policy = configuredAgentBudget();
    if (
      input.dailyCapMicros !== null &&
      (input.dailyCapMicros > policy.dailyCapMicros ||
        input.dailyCapMicros < policy.maxRequestMicros)
    )
      throw new ApiError(
        400,
        'Daily limit must be between the request reservation and configured ceiling.',
      );
    if (input.requestsPerUser !== null && input.requestsPerUser > policy.requestsPerUser)
      throw new ApiError(400, 'User limit cannot exceed the configured ceiling.');
    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        ServiceControl[]
      >`SELECT "aiPaused", "dailyCapMicros", "requestsPerUser", "version" FROM "ServiceControl" WHERE "id" = 'global' FOR UPDATE`;
      const previous = rows[0];
      if (!previous || previous.version !== input.version)
        throw new ApiError(409, 'Controls changed in another session. Refresh before saving.');
      await tx.$executeRaw`UPDATE "ServiceControl" SET "aiPaused" = ${input.aiPaused}, "dailyCapMicros" = ${input.dailyCapMicros}, "requestsPerUser" = ${input.requestsPerUser}, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = 'global'`;
      await tx.$executeRaw`INSERT INTO "AdminAudit" ("id", "actorId", "action", "details") VALUES (${randomUUID()}, ${user.id}, 'service_controls', ${JSON.stringify({ before: previous, after: input })}::jsonb)`;
    });
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
