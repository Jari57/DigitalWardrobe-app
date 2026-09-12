import { createHash } from 'node:crypto';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { agentRequestSchema, validateStylistResult } from '@/server/agents/contracts';
import { AgentLedger, configuredAgentBudget } from '@/server/agents/ledger';
import { styleOwnedWardrobe } from '@/server/agents/stylist';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  let dispatched: { ledger: AgentLedger; userId: string; id: string } | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, agentRequestSchema);
    if (input.agent !== 'stylist') throw new ApiError(400, 'Choose the stylist action.');
    if (!input.candidateIds.length) throw new ApiError(400, 'Add some pieces to your closet first.');
    if (input.lockedIds.length > 12 || input.lockedIds.some(id => !input.candidateIds.includes(id))) throw new ApiError(400, 'Choose at most 12 locks from the available pieces.');
    await rateLimit(`stylist:${user.id}`, 20, 3600);
    const candidates = await db.garment.findMany({ where: { userId: user.id, id: { in: input.candidateIds } }, select: { id: true, name: true, category: true, color: true }, orderBy: { id: 'asc' } });
    if (candidates.length !== input.candidateIds.length) throw new ApiError(404, 'Some pieces are unavailable. Refresh your closet.');
    if (process.env.AI_ENABLED !== 'true') throw new ApiError(503, 'AI styling is not enabled on this deployment.');
    const normalized = { ...input, candidateIds: candidates.map(item => item.id), lockedIds: [...input.lockedIds].sort() };
    // Include saved details so editing a piece invalidates an earlier recommendation.
    const key = createHash('sha256').update(JSON.stringify({ version: 'stylist-v1', input: normalized, candidates, day: new Date().toISOString().slice(0, 10) })).digest('hex');
    const ledger = new AgentLedger(db, configuredAgentBudget());
    const { request: record } = await ledger.reserve(user.id, key, normalized).catch(() => { throw new ApiError(429, 'Today’s AI allowance is used up. Random Reveal is still available.'); });
    if (record.result) return json({ ...validateStylistResult(record.result, normalized.candidateIds, input.lockedIds), id: record.id });
    if (!await ledger.claim(user.id, record.id)) throw new ApiError(409, 'This styling request is processing or was interrupted. Change your preferences or try tomorrow.');
    dispatched = { ledger, userId: user.id, id: record.id };
    const result = await styleOwnedWardrobe(candidates, input.lockedIds, input.occasion, input.aesthetic);
    if (result.cost === null) await db.agentRequest.updateMany({ where: { id: record.id, userId: user.id, state: 'dispatched' }, data: { state: 'uncertain', result: result.value, inputTokens: result.inputTokens, outputTokens: result.outputTokens } });
    else await ledger.settle(user.id, record.id, { state: 'succeeded', actualMicros: result.cost, inputTokens: result.inputTokens, outputTokens: result.outputTokens, result: result.value });
    // Recheck ownership after the provider call: a piece may have been deleted in another tab.
    if (await db.garment.count({ where: { userId: user.id, id: { in: result.value.garmentIds } } }) !== result.value.garmentIds.length) throw new ApiError(409, 'Your closet changed. Refresh before styling again.');
    return json({ ...result.value, id: record.id });
  } catch (error) {
    if (dispatched) {
      await dispatched.ledger.markUncertain(dispatched.userId, dispatched.id).catch(() => {});
      if (error instanceof ApiError) return handleError(error);
      console.error('Stylist generation failed', { name: error instanceof Error ? error.name : 'UnknownError', requestId: dispatched.id });
      return json({ error: 'AI styling could not finish. Your current outfit is unchanged. Random Reveal is still available.' }, 503);
    }
    return handleError(error);
  }
}
