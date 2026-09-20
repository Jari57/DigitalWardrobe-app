import { createHash } from 'node:crypto';
import { db } from '@/server/db';
import {
  feedbackDetailsSchema,
  feedbackReasons,
  learningRules,
  type AgentMemory,
  type LearningAgent,
} from '@/lib/agent-learning';
export function deriveAgentMemory(
  agent: LearningAgent,
  records: { feedback: string | null; feedbackDetails: unknown; result: unknown }[],
): AgentMemory {
  const reasons = new Set<string>();
  const avoidCombinations: string[][] = [],
    preferredCombinations: string[][] = [];
  let feedbackCount = 0;
  for (const record of records.slice(0, 50)) {
    const details = feedbackDetailsSchema.safeParse(record.feedbackDetails);
    if (!details.success || !details.data.remember || !record.feedback) continue;
    feedbackCount++;
    const reason = details.data.reason;
    if (
      record.feedback === 'not-helpful' &&
      reason &&
      Object.hasOwn(feedbackReasons[agent], reason)
    )
      reasons.add(reason);
    if (agent === 'stylist' && record.result && typeof record.result === 'object') {
      const ids = (record.result as { garmentIds?: unknown }).garmentIds;
      if (
        Array.isArray(ids) &&
        ids.length > 1 &&
        ids.length <= 12 &&
        ids.every((id) => typeof id === 'string' && id.length <= 80)
      ) {
        if (record.feedback === 'not-helpful' && reason === 'bad-pairing')
          avoidCombinations.push([...ids].sort());
        if (record.feedback === 'helpful') preferredCombinations.push([...ids].sort());
      }
    }
  }
  // The newest explicit preference wins when reasons conflict. Records arrive newest first.
  if (reasons.has('too-formal') && reasons.has('too-casual')) {
    const first = [...reasons].find((reason) => reason === 'too-formal' || reason === 'too-casual');
    reasons.delete(first === 'too-formal' ? 'too-casual' : 'too-formal');
  }
  const content = {
    feedbackCount,
    rules: [...reasons].slice(0, 6).map((reason) => learningRules[reason]),
    avoidCombinations: avoidCombinations.slice(0, 6),
    preferredCombinations: preferredCombinations.slice(0, 3),
  };
  return {
    ...content,
    version: feedbackCount
      ? createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 20)
      : 'none',
  };
}
export async function loadAgentMemory(userId: string, agent: LearningAgent) {
  const records = await db.agentRequest.findMany({
    where: { userId, agent, feedback: { not: null } },
    orderBy: { feedbackAt: 'desc' },
    take: 50,
    select: { feedback: true, feedbackDetails: true, result: true },
  });
  return deriveAgentMemory(agent, records);
}
