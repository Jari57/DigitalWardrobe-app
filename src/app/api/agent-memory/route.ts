import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/server/auth';
import { db } from '@/server/db';
import { checkOrigin, handleError, json, readJson } from '@/server/http';
import { learningAgents } from '@/lib/agent-learning';
import { loadAgentMemory } from '@/server/agents/memory';
export async function GET() {
  try {
    const user = await requireUser();
    const entries = await Promise.all(
      learningAgents.map(async (agent) => [agent, await loadAgentMemory(user.id, agent)]),
    );
    const agents = Object.fromEntries(entries);
    const style = agents.stylist as Awaited<ReturnType<typeof loadAgentMemory>>;
    const ids = [...new Set([...style.avoidCombinations, ...style.preferredCombinations].flat())];
    const garments = ids.length
      ? await db.garment.findMany({
          where: { userId: user.id, id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    return json({
      agents,
      garmentNames: Object.fromEntries(garments.map((garment) => [garment.id, garment.name])),
    });
  } catch (error) {
    return handleError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser();
    const input = await readJson(
      request,
      z.object({ agent: z.enum(learningAgents).optional() }).strict(),
    );
    await db.agentRequest.updateMany({
      where: { userId: user.id, ...(input.agent ? { agent: input.agent } : {}) },
      data: { feedbackDetails: Prisma.DbNull },
    });
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
