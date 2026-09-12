import { withAgentUsage } from '@/server/agents/usage';
import { createHash } from 'node:crypto';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { agentRequestSchema, validateSpotterResult } from '@/server/agents/contracts';
import { AgentLedger, configuredAgentBudget } from '@/server/agents/ledger';
import { matchInspiration } from '@/server/agents/spotter';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  let dispatched: { ledger: AgentLedger; userId: string; id: string } | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, agentRequestSchema);
    if (input.agent !== 'spotter') throw new ApiError(400, 'Choose the spotter action.');
    await rateLimit(`spotter:${user.id}`, 20, 3600);
    const [image, candidates] = await Promise.all([
      db.image.findFirst({ where: { id: input.imageId, userId: user.id } }),
      db.garment.findMany({
        where: { userId: user.id, id: { in: input.candidateIds } },
        select: { id: true, name: true, category: true, color: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    if (!image || candidates.length !== input.candidateIds.length)
      throw new ApiError(404, 'Photo or closet pieces unavailable. Refresh and try again.');
    if (process.env.AI_ENABLED !== 'true')
      throw new ApiError(503, 'AI matching is not enabled on this deployment.');
    const normalized = { ...input, candidateIds: candidates.map((c) => c.id) };
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          version: 'spotter-v2',
          input: normalized,
          candidates,
          day: new Date().toISOString().slice(0, 10),
        }),
      )
      .digest('hex');
    const ledger = new AgentLedger(db, configuredAgentBudget());
    const { request: record } = await ledger.reserve(user.id, key, normalized).catch(() => {
      throw new ApiError(
        429,
        'Today’s AI allowance is used up. You can still pair pieces manually.',
      );
    });
    if (record.result)
      return json({
        ...validateSpotterResult(record.result, normalized.candidateIds),
        id: record.id,
      });
    if (!(await ledger.claim(user.id, record.id)))
      throw new ApiError(
        409,
        'This matching request is processing or was interrupted. Try again tomorrow.',
      );
    dispatched = { ledger, userId: user.id, id: record.id };
    const result = await withAgentUsage(user.id, record.id, () =>
      matchInspiration(image.data, image.mimeType, candidates),
    );
    if (result.cost === null)
      await db.agentRequest.updateMany({
        where: { id: record.id, userId: user.id, state: 'dispatched' },
        data: {
          state: 'uncertain',
          result: result.value,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      });
    else
      await ledger.settle(user.id, record.id, {
        state: 'succeeded',
        actualMicros: result.cost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        result: result.value,
      });
    const ids = result.value.elements.flatMap((e) => (e.garmentId ? [e.garmentId] : []));
    if ((await db.garment.count({ where: { userId: user.id, id: { in: ids } } })) !== ids.length)
      throw new ApiError(409, 'Your closet changed. Refresh before using these matches.');
    return json({ ...result.value, id: record.id });
  } catch (error) {
    if (dispatched) {
      await dispatched.ledger.markUncertain(dispatched.userId, dispatched.id).catch(() => {});
      if (error instanceof ApiError) return handleError(error);
      console.error('Spotter generation failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId: dispatched.id,
      });
      return json(
        {
          error:
            'Matching could not finish. Your saved pairings are unchanged; you can still edit them manually.',
        },
        503,
      );
    }
    return handleError(error);
  }
}
