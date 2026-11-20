import type { CostRow, MoneyInputs } from './types';

/**
 * Pure money formulas (research/money.md). Plan A calls computeCosts() to fill Report.costs.rows;
 * Plan B calls the same function when the buyer edits the price. Neither re-implements it.
 * Update the constants each fiscal year (the tax rate is adopted each September).
 */
export const MONEY = {
  taxRate: 0.0118162182,      // FY 2026-27, Board of Supervisors resolution r0524-26
  flatParcelTaxes: 796,       // SFUSD + City College parcel taxes, single-family, FY 2025-26
  homeownersExemption: 7000,
  transferTax(price: number): number {
    if (price <= 250_000) return 0.005;
    if (price < 1_000_000) return 0.0068;
    if (price < 5_000_000) return 0.0075;
    if (price < 10_000_000) return 0.0225;
    if (price < 25_000_000) return 0.055;
    return 0.06;
  },
} as const;

/** Months from the 1st of the month after closing through June 30 (fiscal year end). */
export function supplementalFraction(closing: Date): number {
  const start = new Date(closing.getFullYear(), closing.getMonth() + 1, 1);
  const fyEndYear = start.getMonth() > 5 ? start.getFullYear() + 1 : start.getFullYear();
  const months = (fyEndYear - start.getFullYear()) * 12 + (6 - start.getMonth());
  return months / 12;
}

export function computeCosts(price: number, inputs: MoneyInputs, closing: Date = nextMonth()): CostRow[] {
  const r = MONEY.taxRate;
  const s = inputs.sourceIndex;
  const exemption = inputs.ownerOccupied ? MONEY.homeownersExemption : 0;
  const mello = inputs.melloRoosPerSqft && inputs.sqft ? inputs.melloRoosPerSqft * inputs.sqft : 0;
  const annual = (price - exemption) * r + MONEY.flatParcelTaxes + mello;
  const rows: CostRow[] = [
    {
      kind: 'property_tax', title: 'Property tax', amount: round(annual), per: 'year', estimate: false,
      text: `${pct(r)} of your price after the homeowners' exemption, plus flat parcel taxes [${s.taxRate}]`,
    },
  ];
  if (inputs.assessedValue != null) {
    const supp = (price - inputs.assessedValue) * r * supplementalFraction(closing);
    rows.push(supp > 0
      ? { kind: 'supplemental_tax', title: 'Supplemental tax bill', amount: round(supp), per: 'once', estimate: true,
          text: `One-time catch-up from the current assessed value if you close next month. It arrives 6 to 12 months after closing [${s.supplemental}]` }
      : { kind: 'supplemental_tax', title: 'Supplemental tax bill', amount: 0, per: 'once', estimate: true,
          text: `Your price is below the current assessed value, so expect a refund bill, not a charge [${s.supplemental}]` });
  }
  const tr = MONEY.transferTax(price);
  rows.push({
    kind: 'transfer_tax', title: 'Transfer tax', amount: round(price * tr), per: 'once', estimate: false,
    text: `${pct(tr)} of the full price. In San Francisco the seller usually pays it [${s.transferTax}]`,
  });
  if (inputs.openCaseMonthlyFee && s.caseFees) {
    rows.push({
      kind: 'case_fees', title: 'Open complaint fees', amount: inputs.openCaseMonthlyFee, per: 'month', estimate: false,
      text: `Violation monitoring while complaints stay open. Work without a permit adds 9 times the permit issuance fee [${s.caseFees}]`,
    });
  }
  return rows;
}

function nextMonth(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1); }
function round(n: number): number { return Math.round(n); }
function pct(n: number): string { return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 4 }).format(n); }
