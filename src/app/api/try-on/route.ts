import { createHash } from 'node:crypto';
import { z } from 'zod';
import { tryOnRequestSchema } from '@/server/agents/contracts';
import { AgentLedger } from '@/server/agents/ledger';
import { renderTryOn, tryOnInstructions, tryOnModel } from '@/server/agents/try-on';
import { generationCost, recordStepUsage, withAgentUsage } from '@/server/agents/usage';
import { rateLimit, requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { normalizeImage } from '@/server/images';
import { imageIdFromUrl } from '@/server/records';
import { controlledAgentBudget } from '@/server/service-control';
import { imageUrlSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const maxDuration = 100;

const previewSchema = z.object({ imageUrl: imageUrlSchema });

function tryOnConfigured() {
  return (
    process.env.NEXT_PUBLIC_FITSTALKER_TRY_ON_ENABLED === 'true' &&
    process.env.AI_ENABLED === 'true'
  );
}

function approvedTryOnCost(policy: Awaited<ReturnType<typeof controlledAgentBudget>>) {
  const cost = Number(process.env.FITSTALKER_TRY_ON_MAX_COST_MICROS);
  return Number.isSafeInteger(cost) &&
    cost > 0 &&
    cost <= Math.min(policy.maxRequestMicros, policy.dailyCapMicros)
    ? cost
    : null;
}

export async function GET() {
  try {
    await requireUser();
    if (!tryOnConfigured()) return json({ enabled: false });
    const policy = await controlledAgentBudget().catch(() => null);
    return json({ enabled: policy !== null && approvedTryOnCost(policy) !== null });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  let dispatched: { ledger: AgentLedger; userId: string; id: string } | undefined;
  try {
    checkOrigin(request);
    if (!tryOnConfigured()) throw new ApiError(503, 'Try-on is currently unavailable.');

    const { id: userId } = await requireUser();
    const input = await readJson(request, tryOnRequestSchema);
    await rateLimit(`try-on:${userId}`, 12, 3600);
    const [photo, garments, policy] = await Promise.all([
      db.image.findFirst({ where: { id: imageIdFromUrl(input.photoUrl), userId } }),
      db.garment.findMany({
        where: { userId, id: { in: input.garmentIds }, image: { userId } },
        select: { id: true, image: { select: { id: true, data: true, mimeType: true } } },
      }),
      controlledAgentBudget(),
    ]);
    if (!photo || garments.length !== input.garmentIds.length)
      throw new ApiError(404, 'Your photo or a selected closet piece is unavailable.');
    const approvedCost = approvedTryOnCost(policy);
    if (approvedCost === null) throw new ApiError(503, 'Try-on is currently unavailable.');

    const imagesByGarment = new Map(garments.map(({ id, image }) => [id, image]));
    const ordered = input.garmentIds.flatMap((id) => imagesByGarment.get(id) ?? []);
    const ledger = new AgentLedger(db, { ...policy, maxRequestMicros: approvedCost });
    const key = createHash('sha256')
      .update(
        JSON.stringify([
          tryOnModel,
          tryOnInstructions,
          input,
          ordered.map((p) => p.id),
          new Date().toISOString().slice(0, 10),
        ]),
      )
      .digest('hex');
    const { request: record } = await ledger.reserve(userId, key, input).catch((error: unknown) => {
      if (
        error instanceof Error &&
        /Daily (generation allowance|AI budget) reached/.test(error.message)
      )
        throw new ApiError(429, 'Today’s AI allowance is used up. Your look is still available.');
      throw error;
    });
    const cached = previewSchema.safeParse(record.result);
    if (
      cached.success &&
      (await db.image.count({ where: { id: imageIdFromUrl(cached.data.imageUrl), userId } }))
    )
      return json(cached.data);
    if (!(await ledger.claim(userId, record.id)))
      throw new ApiError(
        409,
        record.state === 'dispatched'
          ? 'This preview is already processing. Give it a moment and check again.'
          : 'This preview could not be recovered. Choose a different photo or try again tomorrow.',
      );
    dispatched = { ledger, userId, id: record.id };
    const preview = await withAgentUsage(userId, record.id, async () => {
      const result = await renderTryOn(photo, ordered, recordStepUsage);
      const cost = await generationCost(result);
      const file = result.files.find((item) => /^image\//.test(item.mediaType));
      if (!file)
        throw new ApiError(
          502,
          'The image service did not return a preview. Try a different photo.',
        );
      const normalized = await normalizeImage(file.uint8Array).catch(() => {
        throw new ApiError(502, 'The image service returned an unreadable preview.');
      });
      const image = await db.image.create({
        data: { ...normalized, userId },
        select: { id: true },
      });
      const value = { imageUrl: `/api/images/${image.id}` };
      const inputTokens = result.totalUsage.inputTokens ?? 0;
      const outputTokens = result.totalUsage.outputTokens ?? 0;
      if (cost === null)
        await db.agentRequest.updateMany({
          where: { id: record.id, userId, state: 'dispatched' },
          data: { state: 'uncertain', result: value, inputTokens, outputTokens },
        });
      else
        await ledger.settle(userId, record.id, {
          state: 'succeeded',
          result: value,
          actualMicros: cost,
          inputTokens,
          outputTokens,
        });
      return value;
    });
    return json(preview, 201);
  } catch (error) {
    if (dispatched) {
      const { ledger, userId, id } = dispatched;
      await ledger.markUncertain(userId, id).catch(() => {});
      await ledger.settleFailedSingleStage(userId, id).catch(() => {});
      if (!(error instanceof ApiError))
        return json(
          { error: 'Try-on could not finish. Your outfit is safe. Check again in a moment.' },
          503,
        );
    }
    return handleError(error);
  }
}
