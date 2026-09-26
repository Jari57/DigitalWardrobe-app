import { loadAgentMemory } from '@/server/agents/memory';
import { loadClothingPreference } from '@/server/agents/clothing-preference';
import { withAgentUsage } from '@/server/agents/usage';
import { reviewShoppingResult } from '@/lib/shopping-quality';
import type { ShoppingResult } from '@/lib/discovery';
import { recordJourney } from '@/server/journey';
import { z } from 'zod';
import { discoveryRequestKey } from '@/server/agents/discovery-key';
import type { Prisma } from '@prisma/client';
import { requireUser, rateLimit } from '@/server/auth';
import { db } from '@/server/db';
import { ApiError, checkOrigin, handleError, json, readJson } from '@/server/http';
import { AgentLedger, configuredAgentBudget } from '@/server/agents/ledger';
import { detectClothes, findClothes } from '@/server/agents/discovery';
import {
  captureSummary,
  detectionSchema,
  shoppingRequestSchema,
  shoppingItem,
} from '@/lib/discovery';

export const runtime = 'nodejs';
export const maxDuration = 180;
const inputSchema = z.discriminatedUnion('agent', [
  z
    .object({
      agent: z.literal('detect'),
      imageId: z.string().min(1).max(80),
      retry: z.boolean().optional(),
    })
    .strict(),
  shoppingRequestSchema.extend({ retry: z.boolean().optional() }),
]);

export async function GET() {
  try {
    const user = await requireUser();
    const records = await db.agentRequest.findMany({
      where: { userId: user.id, agent: 'detect' },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const searches = records.length
      ? await db.agentRequest.findMany({
          where: {
            userId: user.id,
            agent: 'shop',
            OR: records.map((record) => ({
              result: { path: ['searchContext', 'detectionId'], equals: record.id },
            })),
          },
          orderBy: { createdAt: 'desc' },
          take: 36,
          select: { id: true, result: true },
        })
      : [];
    return json({
      enabled: process.env.AI_ENABLED === 'true',
      searches: searches.map((record) =>
        reviewShoppingResult({
          ...(record.result as Prisma.JsonObject),
          id: record.id,
        } as ShoppingResult),
      ),
      detections: records
        .filter((r) => r.result)
        .map((r) => {
          const value = r.result as Prisma.JsonObject;
          return {
            ...value,
            note: captureSummary(Array.isArray(value.items) ? value.items.length : 0),
            id: r.id,
          };
        }),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  let dispatched: { ledger: AgentLedger; userId: string; id: string; agent: string } | undefined;
  try {
    checkOrigin(request);
    const user = await requireUser();
    const { retry, ...input } = await readJson(request, inputSchema);
    await rateLimit(`discovery:${user.id}`, 20, 3600);
    if (process.env.AI_ENABLED !== 'true')
      throw new ApiError(503, 'Clothing discovery is not enabled on this deployment yet.');
    const image =
      input.agent === 'detect'
        ? await db.image.findFirst({ where: { id: input.imageId, userId: user.id } })
        : null;
    const detection =
      input.agent === 'shop'
        ? await db.agentRequest.findFirst({
            where: { id: input.detectionId, userId: user.id, agent: 'detect' },
          })
        : null;
    if (input.agent === 'detect' && !image)
      throw new ApiError(404, 'Photo not found. Upload a photo from your account.');
    const parsed = detection?.result
      ? detectionSchema.parse(
          detection.result && {
            items: (detection.result as Prisma.JsonObject).items,
            note: (detection.result as Prisma.JsonObject).note,
          },
        )
      : null;
    const item = input.agent === 'shop' ? parsed?.items[input.itemIndex] : null;
    if (input.agent === 'shop' && !item)
      throw new ApiError(404, 'Detected piece not found. Scan a photo first.');
    const memory = await loadAgentMemory(user.id, input.agent);
    const clothingPreference =
      input.agent === 'shop' ? await loadClothingPreference(user.id) : 'all-styles';
    const photoPath = detection?.result && (detection.result as Prisma.JsonObject).imageUrl;
    const photoId =
      typeof photoPath === 'string'
        ? photoPath.match(/^\/api\/images\/([a-zA-Z0-9_-]+)$/)?.[1]
        : undefined;
    const shoppingPhoto = photoId
      ? await db.image.findFirst({ where: { id: photoId, userId: user.id } })
      : null;
    const key = discoveryRequestKey(input, undefined, memory.version, clothingPreference);
    const ledger = new AgentLedger(db, configuredAgentBudget());
    let reservation;
    try {
      reservation = await ledger.reserve(user.id, key, input);
    } catch {
      throw new ApiError(429, 'Today’s discovery allowance is used up. Please try again tomorrow.');
    }
    const record = reservation.request;
    if (record.result) {
      // Attach context to older cached shopping results without generating again.
      const cached = (
        input.agent === 'shop'
          ? reviewShoppingResult(record.result as unknown as ShoppingResult)
          : record.result
      ) as Prisma.JsonObject;
      if (input.agent === 'shop' && !cached.searchContext) {
        const value = {
          ...cached,
          searchContext: {
            detectionId: input.detectionId,
            itemIndex: input.itemIndex,
            ...(input.description ? { description: input.description } : {}),
            ...(input.preferences ? { preferences: input.preferences } : {}),
          },
        };
        await db.agentRequest.updateMany({
          where: { id: record.id, userId: user.id },
          data: { result: value },
        });
        return json({ ...value, id: record.id });
      }
      return json({ ...cached, id: record.id });
    }
    if (retry && record.state === 'failed') await ledger.retryRejected(user.id, record.id);
    if (!(await ledger.claim(user.id, record.id)))
      throw new ApiError(
        409,
        'This scan or search is already processing or was interrupted. Check your recent scans before trying again tomorrow.',
      );
    dispatched = { ledger, userId: user.id, id: record.id, agent: input.agent };
    const result = await withAgentUsage(user.id, record.id, async () =>
      image
        ? await detectClothes(image.data, image.mimeType, memory)
        : await findClothes(
            shoppingItem(item!, input.agent === 'shop' ? input.description : undefined),
            input.agent === 'shop' ? input.country : 'US',
            input.agent === 'shop' ? input.preferences : undefined,
            { memory, clothingPreference, ...(shoppingPhoto ? { photo: shoppingPhoto } : {}) },
          ),
    );
    const value = {
      ...result.value,
      ...(image ? { imageUrl: `/api/images/${image.id}` } : {}),
      ...(input.agent === 'shop'
        ? {
            searchContext: {
              detectionId: input.detectionId,
              itemIndex: input.itemIndex,
              ...(input.description ? { description: input.description } : {}),
              ...(input.preferences ? { preferences: input.preferences } : {}),
            },
          }
        : {}),
    };
    if (result.cost === null) {
      // Preserve useful results but keep the entire budget hold until cost can be reconciled.
      await db.agentRequest.updateMany({
        where: { id: record.id, userId: user.id, state: 'dispatched' },
        data: {
          state: 'uncertain',
          result: value,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      });
    } else {
      await ledger.settle(user.id, record.id, {
        state: 'succeeded',
        actualMicros: result.cost,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        result: value,
      });
    }
    if (input.agent === 'detect') await recordJourney(user.id, 'identification');
    else if ('listings' in value && Array.isArray(value.listings) && value.listings.length)
      await recordJourney(user.id, 'shopping_results');
    return json({ ...value, id: record.id });
  } catch (error) {
    if (dispatched) {
      await recordJourney(dispatched.userId, 'service_failure');
      await dispatched.ledger.markUncertain(dispatched.userId, dispatched.id).catch(() => {});
      await dispatched.ledger
        .settleFailedSingleStage(dispatched.userId, dispatched.id)
        .catch(() => {});
      const status =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number(error.statusCode)
          : undefined;
      // Only single-stage detection rejections can prove no previous call succeeded.
      // Shopping may complete a stage without a receipt ID; always retain its hold.
      const initialRejected =
        dispatched.agent === 'detect' &&
        [402, 403, 429].includes(status ?? 0) &&
        error instanceof Error &&
        error.name === 'AI_APICallError' &&
        (await db.agentGeneration.count({ where: { requestId: dispatched.id } })) === 0;
      if (initialRejected)
        await dispatched.ledger.settle(dispatched.userId, dispatched.id, {
          state: 'failed',
          actualMicros: 0,
          inputTokens: 0,
          outputTokens: 0,
        });
      console.error('Discovery provider failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        status,
        requestId: dispatched.id,
      });
      if (status === 429)
        return json(
          {
            error: initialRejected
              ? 'The provider rejected this request before generation. Your photo is saved. Retry manually when service capacity returns; a retry uses a new allowance reservation.'
              : 'The AI provider is at its usage limit. Your photo is saved. This interrupted request remains held until its cost is known.',
          },
          429,
        );
      if (status === 402 || status === 403)
        return json(
          {
            error:
              'AI provider access needs attention. Your photo is saved. Clothing discovery will be available once service access is restored.',
          },
          503,
        );
      return json(
        {
          error:
            'Discovery could not finish. Your photo is safe. This request will not be charged again automatically; try a different photo or come back tomorrow.',
        },
        503,
      );
    }
    return handleError(error);
  }
}
