import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { Report, StreamEvent } from '../../src/contract/types';

/** Offline: every city request is served from tests/server/recordings; the Claude CLI is off. */
export function offline(): void {
  process.env.HC_REPLAY_DIR = path.resolve(import.meta.dirname, 'recordings');
  process.env.HC_NOW = '2026-11-20T22:00:00Z';
  process.env.HC_LLM = 'off';
  process.env.HC_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'hc-test-'));
  delete process.env.RESEND_API_KEY;
}

export const FIXED = { now: new Date('2026-11-20T22:00:00Z'), closing: new Date('2026-12-01T12:00:00Z') };

export async function run(text: string, opts: { failStep?: string; save?: boolean } = {}): Promise<{ events: StreamEvent[]; report: Report | null }> {
  const { runCheck } = await import('../../src/server/pipeline');
  if (opts.failStep) process.env.HC_FAIL = opts.failStep; else delete process.env.HC_FAIL;
  const events: StreamEvent[] = [];
  const report = await runCheck(text, (e) => { events.push(e); }, { ...FIXED, save: opts.save ?? false });
  delete process.env.HC_FAIL;
  return { events, report };
}

/** Every reader-facing string in a report, with its copy options (same walk as tests/contract/fixture.test.ts). */
export function strings(r: Report): Array<{ where: string; text: string; email?: boolean; max?: number }> {
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
