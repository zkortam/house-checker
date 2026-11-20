import { describe, expect, it } from 'vitest';
import { FIXTURES } from '@contract/fixtures';
import { LABELS } from '@contract/labels';
import { computeCosts } from '@contract/money';

/** What the report view renders from each fixture: no undefined, NaN or dangling citations. */
describe('fixtures render cleanly', () => {
  for (const f of FIXTURES) {
    it(f.key, () => {
      const r = f.report;
      expect(r.glance).toHaveLength(6);
      for (const row of r.ledger) expect(LABELS[row.label]).toBeTruthy();
      const all = JSON.stringify(r);
      expect(all).not.toMatch(/undefined|NaN/);
      const n = r.sources.length;
      for (const m of all.matchAll(/\[(\d+)\]/g)) expect(Number(m[1])).toBeLessThanOrEqual(n);
      const rows = computeCosts(r.costs.price * 1.1, r.costs.inputs);
      for (const c of rows) expect(Number.isFinite(c.amount ?? 0)).toBe(true);
      for (const u of r.unknowns) expect(['listing_agent', 'city', 'specialist', 'buyer_agent']).toContain(u.resolver);
    });
  }
});
