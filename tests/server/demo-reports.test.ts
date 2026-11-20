import { beforeAll, describe, expect, it } from 'vitest';
import { checkCitations, checkCopy } from '../../src/contract/copy';
import { DEMO_LISTINGS } from '../../src/server/demo-listings';
import { offline, run, strings } from './helpers';

beforeAll(() => offline());

describe.each(DEMO_LISTINGS.map((l) => [l.key, l] as const))('demo report %s', (_k, l) => {
  it('is complete, cited and passes the copy rules', async () => {
    const { report } = await run(l.text);
    expect(report).not.toBeNull();
    const r = report!;
    expect(r.glance.map((g) => g.section)).toEqual(['ledger', 'cases', 'costs', 'tenants', 'hazards', 'upside']);
    expect(r.highlights.good.length).toBeGreaterThanOrEqual(2);
    expect(r.highlights.watch.length).toBeGreaterThanOrEqual(1);
    expect(r.decision.title.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(Object.keys(r.sections).length).toBe(11);
    const problems: string[] = [];
    for (const s of strings(r)) {
      for (const p of checkCopy(s.text, { email: s.email, maxLength: s.max })) problems.push(`${s.where}: ${p.rule} (${p.match}) in "${s.text}"`);
      for (const p of checkCitations(s.text, r.sources.length)) problems.push(`${s.where}: ${p.rule} (${p.match})`);
    }
    expect(problems).toEqual([]);
    expect(new Set(r.sources.map((s) => s.id)).size).toBe(r.sources.length);
    for (const s of r.sources) expect(s.url === null || /^https:\/\//.test(s.url)).toBe(true);
    // No personal names: business registration sources link the dataset page only.
    for (const s of r.sources.filter((x) => x.dataset === 'g8m3-pdis')) expect(s.url).toBe('https://data.sf.gov/d/g8m3-pdis');
    expect(JSON.stringify(r)).not.toMatch(/undefined|NaN/);
  });
});

describe('rules', () => {
  it('2055 42nd Ave proposes no specialist; 57 Carmelita St proposes a structural engineer', async () => {
    const a = (await run(DEMO_LISTINGS[0].text)).report!;
    const b = (await run(DEMO_LISTINGS[1].text)).report!;
    expect(a.unknowns.some((u) => u.action === 'book_specialist')).toBe(false);
    expect(b.unknowns.find((u) => u.action === 'book_specialist')?.specialist).toBe('structural engineer');
  });

  it('63 Jules Ave: bath added under a finaled permit reads as approved, tax roll behind', async () => {
    const r = (await run(DEMO_LISTINGS[4].text)).report!;
    expect(r.ledger.find((x) => x.key === 'baths')?.label).toBe('permitted_not_updated');
    expect(r.hazards.find((h) => h.key === 'landslide')?.status).toBe('note');
  });
});

describe('errors', () => {
  it('a forced timeout yields a failed step and an error section while the rest completes', async () => {
    const { events, report } = await run(DEMO_LISTINGS[0].text, { failStep: 'complaints' });
    const failed = events.filter((e) => e.type === 'step' && e.status === 'failed');
    expect(failed.map((e) => (e as { id: string }).id)).toEqual(['complaints']);
    expect(report!.sections.cases).toEqual({ state: 'error', source: 'DBI complaints', retryable: true });
    expect(report!.sections.ledger.state).toBe('ok');
    expect(events.at(-1)?.type).toBe('done');
  });

  it('a Berkeley listing returns outside_sf', async () => {
    const { events } = await run('Charming bungalow at 1234 Cedar St, Berkeley, CA. 2 bed, 1 bath. $1,100,000.');
    expect(events).toEqual([{ type: 'error', error: { kind: 'outside_sf', retryable: false, field: 'listingText' } }]);
  });

  it('text without an address returns invalid', async () => {
    const { events } = await run('Lovely home with great light and a garden.');
    expect(events[0]).toMatchObject({ type: 'error', error: { kind: 'invalid' } });
  });
});
