import { db } from './db';
import { ApiError } from './http';
import { configuredAgentBudget } from './agents/ledger';

export type ServiceControl = {
  aiPaused: boolean;
  dailyCapMicros: number | null;
  requestsPerUser: number | null;
  version: number;
};
export async function serviceControl(): Promise<ServiceControl> {
  const rows = await db.$queryRaw<ServiceControl[]>`
    SELECT "aiPaused", "dailyCapMicros", "requestsPerUser", "version"
    FROM "ServiceControl" WHERE "id" = 'global'`;
  if (!rows[0]) throw new ApiError(503, 'Service controls are unavailable.');
  return rows[0];
}
export async function controlledAgentBudget() {
  const control = await serviceControl();
  if (control.aiPaused)
    throw new ApiError(503, 'AI is temporarily paused. Please try again later.');
  const policy = configuredAgentBudget();
  return {
    ...policy,
    dailyCapMicros: Math.min(
      policy.dailyCapMicros,
      control.dailyCapMicros ?? policy.dailyCapMicros,
    ),
    requestsPerUser: Math.min(
      policy.requestsPerUser,
      control.requestsPerUser ?? policy.requestsPerUser,
    ),
  };
}
