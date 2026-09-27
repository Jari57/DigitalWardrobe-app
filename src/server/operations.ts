import { db } from '@/server/db';
import { serviceControl } from '@/server/service-control';
export async function checkOperations() {
  const day = new Date().toISOString().slice(0, 10);
  const [failures, failedRequests, budget, control] = await Promise.all([
    db.journeyMetric.aggregate({ where: { day, event: 'service_failure' }, _sum: { count: true } }),
    db.agentRequest.count({ where: { day, state: { in: ['failed', 'uncertain'] } } }),
    db.agentBudget.findUnique({ where: { scope_day: { scope: 'agents-v1:global', day } } }),
    serviceControl(),
  ]);
  const deploymentCap = Number(process.env.AI_DAILY_CAP_MICROS);
  const cap = Math.min(deploymentCap, control.dailyCapMicros ?? deploymentCap);
  const signals = [
    // These sources overlap. A threshold on either catches failures outside discovery
    // without adding the same failure twice.
    ...(Math.max(failures._sum.count ?? 0, failedRequests) >= 5
      ? ['Repeated AI service failures']
      : []),
    ...(budget && cap > 0 && budget.heldMicros + budget.spentMicros >= cap * 0.8
      ? ['AI budget at or above 80%']
      : []),
  ];
  if (!signals.length) return { alerts: 0, delivery: 'not-needed' };
  if (!process.env.OPS_ALERT_WEBHOOK) {
    console.warn('Operations alert destination not configured', { signalCount: signals.length });
    return { alerts: signals.length, delivery: 'not-configured' };
  }
  const url = new URL(process.env.OPS_ALERT_WEBHOOK);
  if (url.protocol !== 'https:') throw new Error('Alert destination must use HTTPS.');
  const key = `ops-alert:${day}:${signals.join('|')}`;
  const reservation = await db.rateLimit.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date(Date.now() + 86400000) },
    update: { count: { increment: 1 } },
  });
  if (reservation.count > 1) return { alerts: signals.length, delivery: 'already-sent' };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `FitStalker service alert: ${signals.join('; ')}. Review the administrator dashboard.`,
        service: 'FitStalker',
        signals,
        day,
      }),
      signal: AbortSignal.timeout(8000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Alert delivery failed.');
    return { alerts: signals.length, delivery: 'sent' };
  } catch (error) {
    await db.rateLimit.deleteMany({ where: { key } });
    throw error;
  }
}
