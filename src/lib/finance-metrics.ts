export function growthPercent(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
export type FinanceAssumptions = {
  price: number | null;
  payingAccounts: number | null;
  churnPercent: number | null;
  marginPercent: number | null;
  acquisitionSpend: number | null;
  newPayingAccounts: number | null;
  cashOutflow: number | null;
  cash: number | null;
};
export function financeScenario(input: FinanceAssumptions) {
  const {
    price,
    payingAccounts,
    churnPercent,
    marginPercent,
    acquisitionSpend,
    newPayingAccounts,
    cashOutflow,
    cash,
  } = input;
  if (
    Object.values(input).some((v) => v !== null && (!Number.isFinite(v) || v < 0)) ||
    (churnPercent !== null && churnPercent > 100) ||
    (marginPercent !== null && marginPercent > 100) ||
    (payingAccounts !== null && !Number.isInteger(payingAccounts)) ||
    (newPayingAccounts !== null && !Number.isInteger(newPayingAccounts))
  )
    return null;
  const mrr = price !== null && payingAccounts !== null ? price * payingAccounts : null;
  const monthlyGrossProfit =
    price !== null && marginPercent !== null ? (price * marginPercent) / 100 : null;
  const ltv =
    monthlyGrossProfit !== null && churnPercent !== null && churnPercent > 0
      ? monthlyGrossProfit / (churnPercent / 100)
      : null;
  const cac =
    acquisitionSpend !== null && newPayingAccounts !== null
      ? ratio(acquisitionSpend, newPayingAccounts)
      : null;
  const burn = cashOutflow !== null && mrr !== null ? cashOutflow - mrr : null;
  return {
    mrr,
    arr: mrr === null ? null : mrr * 12,
    ltv,
    cac,
    paybackMonths:
      cac !== null && monthlyGrossProfit !== null ? ratio(cac, monthlyGrossProfit) : null,
    runwayMonths: cash !== null && burn !== null && burn > 0 ? cash / burn : null,
    burn,
  };
}
