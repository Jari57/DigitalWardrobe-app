import { loadAgentMemory } from '@/server/agents/memory';
import { withAgentUsage } from '@/server/agents/usage';
import { createHash } from 'node:crypto';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { agentRequestSchema } from '@/server/agents/contracts';
import { AgentLedger, configuredAgentBudget } from '@/server/agents/ledger';
import { createOutfitContent, creatorVersion } from '@/server/agents/creator';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  let dispatched: { ledger: AgentLedger; userId: string; id: string } | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, agentRequestSchema);
    if (input.agent !== 'creator') throw new ApiError(400, 'Choose a creator action.');
    await rateLimit(`creator:${user.id}`, 20, 3600);
    const outfit = await db.outfit.findFirst({
      where: { id: input.outfitId, userId: user.id },
      include: { pieces: { include: { garment: true }, orderBy: { id: 'asc' } } },
    });
    if (!outfit) throw new ApiError(404, 'Saved look not found.');
    if (!outfit.pieces.length) throw new ApiError(400, 'Add pieces to this look first.');
    if (outfit.pieces.some((p) => p.garment.userId !== user.id))
      throw new ApiError(404, 'Some pieces are unavailable.');
    if (process.env.AI_ENABLED !== 'true') throw new ApiError(503, 'Creator AI is not enabled.');
    const details = {
      name: outfit.name,
      garments: outfit.pieces.map((p) => ({
        name: p.garment.name,
        brand: p.garment.brand,
        category: p.garment.category,
        color: p.garment.color,
      })),
    };
    const memory = await loadAgentMemory(user.id, 'creator');
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          version: creatorVersion,
          memoryVersion: memory.version,
          input,
          details,
          day: new Date().toISOString().slice(0, 10),
        }),
      )
      .digest('hex');
    const ledger = new AgentLedger(db, configuredAgentBudget());
    const { request: record } = await ledger.reserve(user.id, key, input).catch(() => {
      throw new ApiError(
        429,
        'Today’s AI allowance is used up. You can still write and export your own caption.',
      );
    });
    if (record.result)
      return json({ ...(record.result as object), id: record.id, feedback: record.feedback });
    if (!(await ledger.claim(user.id, record.id)))
      throw new ApiError(
        409,
        'This request is processing or was interrupted. Your saved look is safe.',
      );
    dispatched = { ledger, userId: user.id, id: record.id };
    const result = await withAgentUsage(user.id, record.id, () =>
      createOutfitContent(details, input.tone, memory),
    );
    const value = { ...result.value, version: creatorVersion, outfitId: outfit.id };
    if (result.cost === null)
      await db.agentRequest.updateMany({
        where: { id: record.id, userId: user.id, state: 'dispatched' },
        data: {
          state: 'uncertain',
          result: value,
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
        result: value,
      });
    if (!(await db.outfit.count({ where: { id: outfit.id, userId: user.id } })))
      throw new ApiError(409, 'This look was deleted while content was being created.');
    return json({ ...value, id: record.id, feedback: null });
  } catch (error) {
    if (dispatched) {
      await dispatched.ledger.markUncertain(dispatched.userId, dispatched.id).catch(() => {});
      await dispatched.ledger
        .settleFailedSingleStage(dispatched.userId, dispatched.id)
        .catch(() => {});
      if (error instanceof ApiError) return handleError(error);
      return json(
        { error: 'Creator AI could not finish. Your saved look and current edits are safe.' },
        503,
      );
    }
    return handleError(error);
  }
}
