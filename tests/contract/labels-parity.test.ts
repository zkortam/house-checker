import { beforeAll, describe, expect, it } from 'vitest';
import { report2055, report57 } from '../../src/contract/fixtures';
import { offline, run } from '../server/helpers';

/** Plan A's real pipeline (recorded city responses) reproduces the fixtures' ledger labels, case labels and source ids. */
beforeAll(() => offline());

const ledger = (r: { ledger: Array<{ key: string; label: string }> }) => r.ledger.map((x) => `${x.key}:${x.label}`).sort();
const cases = (r: { cases: Array<{ label: string }> }) => r.cases.map((x) => x.label).sort();
const ids = (r: { sources: Array<{ id: string }> }) => r.sources.map((s) => s.id).sort();

describe('labels parity, 2055 42nd Ave', () => {
  it('same ledger labels, case labels and source ids as the fixture', async () => {
    const { report } = await run(report2055.listing.text);
    expect(report).not.toBeNull();
    expect(ledger(report!)).toEqual(ledger(report2055));
    expect(cases(report!)).toEqual(cases(report2055));
    expect(ids(report!)).toEqual(ids(report2055));
    expect(report!.parcels).toEqual(report2055.parcels);
    expect(report!.parcelDisplay).toBe(report2055.parcelDisplay);
    expect(report!.decision.tone).toBe(report2055.decision.tone);
    expect(report!.costs.inputs.assessedValue).toBe(report2055.costs.inputs.assessedValue);
    expect(report!.glance.map((g) => g.value)).toEqual(report2055.glance.map((g) => g.value));
  });
});

describe('labels parity, 57 Carmelita St', () => {
  it('same ledger labels, case labels and source ids as the fixture', async () => {
    const { report } = await run(report57.listing.text);
    expect(ledger(report!)).toEqual(ledger(report57));
    expect(cases(report!)).toEqual(cases(report57));
    expect(ids(report!)).toEqual(ids(report57));
    expect(report!.decision.tone).toBe(report57.decision.tone);
    expect(report!.unknowns.find((u) => u.action === 'book_specialist')?.specialist).toBe('structural engineer');
  });
});
