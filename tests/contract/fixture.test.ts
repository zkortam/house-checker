import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../../src/contract/fixtures';
import { checkCitations, checkCopy } from '../../src/contract/copy';
import type { Report, SectionKey } from '../../src/contract/types';
import { mockStream } from '../../src/contract/mock-stream';

const SECTION_KEYS: SectionKey[] = ['ledger', 'cases', 'costs', 'systems', 'tenants', 'upside', 'hazards', 'nearby', 'history', 'unknowns', 'packet'];
const GLANCE_ORDER: SectionKey[] = ['ledger', 'cases', 'costs', 'tenants', 'hazards', 'upside'];

/** Every reader-facing string in a report, with its copy options. */
function strings(r: Report): Array<{ where: string; text: string; email?: boolean; max?: number }> {
  const out: Array<{ where: string; text: string; email?: boolean; max?: number }> = [];
  const add = (where: string, text: string | null | undefined, max?: number) => { if (text) out.push({ where, text, max }); };
  add('answer', r.answer, 220);
  add('decision.title', r.decision.title);
  add('decision.inspection', r.decision.inspection);
  r.glance.forEach((g, i) => { add(`glance[${i}].label`, g.label); add(`glance[${i}].value`, g.value); add(`glance[${i}].status`, g.status); });
  r.highlights.good.forEach((t, i) => add(`highlights.good[${i}]`, t, 90));
  r.highlights.watch.forEach((t, i) => add(`highlights.watch[${i}]`, t, 90));
  r.ledger.forEach((c, i) => { add(`ledger[${i}].title`, c.title); add(`ledger[${i}].listing`, c.listing, 14); add(`ledger[${i}].records`, c.records, 14); add(`ledger[${i}].why`, c.why); });
  r.cases.forEach((c, i) => { add(`cases[${i}].title`, c.title); add(`cases[${i}].text`, c.text); add(`cases[${i}].stake`, c.stake); });
  r.costs.rows.forEach((c, i) => { add(`costs[${i}].title`, c.title); add(`costs[${i}].text`, c.text); });
  r.systems.forEach((s, i) => { add(`systems[${i}].title`, s.title); add(`systems[${i}].text`, s.text); });
  for (const k of ['tenants', 'upside', 'nearby'] as const) r[k].forEach((s, i) => { add(`${k}[${i}].title`, s.title); add(`${k}[${i}].text`, s.text); });
  r.hazards.forEach((h, i) => { add(`hazards[${i}].title`, h.title); add(`hazards[${i}].text`, h.text); });
  r.history.forEach((h, i) => add(`history[${i}].text`, h.text));
  r.unknowns.forEach((u, i) => { add(`unknowns[${i}].title`, u.title); add(`unknowns[${i}].why`, u.why); });
  for (const s of Object.values(r.sections)) if (s.state === 'empty') add('sections.empty', s.text);
  for (const d of [r.drafts.listingAgentEmail, r.drafts.cityEmail]) if (d) { out.push({ where: 'draft.subject', text: d.subject, email: true }); out.push({ where: 'draft.body', text: d.body, email: true }); }
  return out;
}

describe.each(FIXTURES.map((f) => [f.key, f] as const))('fixture %s', (_key, f) => {
  const r = f.report;

  it('matches its own address', () => {
    expect(f.match.test(r.listing.text)).toBe(true);
    expect(f.match.test(r.address)).toBe(true);
  });

  it('has every section and the glance tiles in order', () => {
    expect(Object.keys(r.sections).sort()).toEqual([...SECTION_KEYS].sort());
    expect(r.glance.map((g) => g.section)).toEqual(GLANCE_ORDER);
    expect(r.highlights.good.length).toBeGreaterThanOrEqual(2);
    expect(r.highlights.good.length).toBeLessThanOrEqual(5);
    expect(r.highlights.watch.length).toBeGreaterThanOrEqual(2);
    expect(r.highlights.watch.length).toBeLessThanOrEqual(5);
    expect(r.decision.title.split(/\s+/).length).toBeLessThanOrEqual(6);
  });

  it('passes copy rules and citations', () => {
    const problems: string[] = [];
    for (const s of strings(r)) {
      for (const p of checkCopy(s.text, { email: s.email, maxLength: s.max })) problems.push(`${s.where}: ${p.rule} (${p.match})`);
      for (const p of checkCitations(s.text, r.sources.length)) problems.push(`${s.where}: ${p.rule} (${p.match})`);
    }
    expect(problems).toEqual([]);
  });

  it('has unique source ids and unknown ids, and drafts point at real unknowns', () => {
    expect(new Set(r.sources.map((s) => s.id)).size).toBe(r.sources.length);
    const ids = new Set(r.unknowns.map((u) => u.id));
    expect(ids.size).toBe(r.unknowns.length);
    for (const d of [r.drafts.listingAgentEmail, r.drafts.cityEmail]) for (const id of d?.unknownIds ?? []) expect(ids.has(id)).toBe(true);
    for (const u of r.unknowns) if (u.action === 'book_specialist') expect(u.specialist).toBeTruthy();
  });

  it('never shows personal names from business registrations', () => {
    const biz = r.sources.filter((s) => s.dataset === 'g8m3-pdis');
    for (const s of biz) expect(s.url).toBe('https://data.sf.gov/d/g8m3-pdis');
  });

  it('replays as a complete mock stream', async () => {
    const types: string[] = [];
    for await (const e of mockStream(r, f.steps, { speed: 1000 })) types.push(e.type);
    expect(types[0]).toBe('run');
    expect(types.at(-2)).toBe('report');
    expect(types.at(-1)).toBe('done');
  });
});
