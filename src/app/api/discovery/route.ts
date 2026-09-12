import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { AgentLedger, configuredAgentBudget } from '@/server/agents/ledger';
import { detectClothes, findClothes } from '@/server/agents/discovery';
import { detectionSchema } from '@/lib/discovery';

export const runtime = 'nodejs';
export const maxDuration = 120;
const inputSchema = z.discriminatedUnion('agent', [
  z.object({ agent: z.literal('detect'), imageId: z.string().min(1).max(80) }).strict(),
  z.object({ agent: z.literal('shop'), detectionId: z.string().min(1).max(80), itemIndex: z.number().int().min(0).max(5), country: z.enum(['US', 'GB', 'CA', 'AU']) }).strict(),
]);

export async function GET() {
  try {
    const user = await requireUser();
    const records = await db.agentRequest.findMany({ where: { userId: user.id, agent: 'detect' }, orderBy: { createdAt: 'desc' }, take: 12 });
    return json({ enabled: process.env.AI_ENABLED === 'true', detections: records.filter(r => r.result).map(r => ({ ...(r.result as object), id: r.id })) });
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request) {
  let dispatched: { ledger: AgentLedger; userId: string; id: string } | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await readJson(request, inputSchema);
    await rateLimit(`discovery:${user.id}`, 20, 3600);
    if (process.env.AI_ENABLED !== 'true') throw new ApiError(503, 'Clothing discovery is not enabled on this deployment yet.');
    const image = input.agent === 'detect' ? await db.image.findFirst({ where: { id: input.imageId, userId: user.id } }) : null;
    const detection = input.agent === 'shop' ? await db.agentRequest.findFirst({ where: { id: input.detectionId, userId: user.id, agent: 'detect' } }) : null;
    if (input.agent === 'detect' && !image) throw new ApiError(404, 'Photo not found. Upload a photo from your account.');
    const parsed = detection?.result ? detectionSchema.parse(detection.result && { items: (detection.result as Prisma.JsonObject).items, note: (detection.result as Prisma.JsonObject).note }) : null;
    const item = input.agent === 'shop' ? parsed?.items[input.itemIndex] : null;
    if (input.agent === 'shop' && !item) throw new ApiError(404, 'Detected piece not found. Scan a photo first.');
    const key = createHash('sha256').update((input.agent === 'shop' ? 'shopping-evidence-v2:' : '') + JSON.stringify(input) + ':' + new Date().toISOString().slice(0, 10)).digest('hex');
    const ledger = new AgentLedger(db, configuredAgentBudget());
    let reservation;
    try { reservation = await ledger.reserve(user.id, key, input); }
    catch { throw new ApiError(429, 'Today’s discovery allowance is used up. Please try again tomorrow.'); }
    const record = reservation.request;
    if (record.result) return json({ ...(record.result as object), id: record.id });
    if (!await ledger.claim(user.id, record.id)) throw new ApiError(409, 'This scan or search is already processing or was interrupted. Check your recent scans before trying again tomorrow.');
    dispatched = { ledger, userId: user.id, id: record.id };
    const result = image ? await detectClothes(image.data, image.mimeType) : await findClothes(item!, input.agent === 'shop' ? input.country : 'US');
    const value = { ...result.value, ...(image ? { imageUrl: `/api/images/${image.id}` } : {}) };
    if (result.cost === null) {
      // Preserve useful results but keep the entire budget hold until cost can be reconciled.
      await db.agentRequest.updateMany({ where: { id: record.id, userId: user.id, state: 'dispatched' }, data: { state: 'uncertain', result: value, inputTokens: result.inputTokens, outputTokens: result.outputTokens } });
    } else {
      await ledger.settle(user.id, record.id, { state: 'succeeded', actualMicros: result.cost, inputTokens: result.inputTokens, outputTokens: result.outputTokens, result: value });
    }
    return json({ ...value, id: record.id });
  } catch (error) {
    if (dispatched) {
      await dispatched.ledger.markUncertain(dispatched.userId, dispatched.id).catch(() => {});
      const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : undefined;
      console.error('Discovery provider failed', { name: error instanceof Error ? error.name : 'UnknownError', status, requestId: dispatched.id });
      if (status === 429) return json({ error: 'The AI provider is at its usage limit. Your photo is saved, but this scan could not finish. Please try again later.' }, 429);
      if (status === 402 || status === 403) return json({ error: 'AI provider access needs attention. Your photo is saved. Clothing discovery will be available once service access is restored.' }, 503);
      return json({ error: 'Discovery could not finish. Your photo is safe. This request will not be charged again automatically; try a different photo or come back tomorrow.' }, 503);
    }
    return handleError(error);
  }
}

