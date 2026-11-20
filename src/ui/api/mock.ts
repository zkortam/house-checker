/** Mock transport: the contract fixtures replayed through mockStream, actions answered locally. */
import type {
  ActionLogEntry, ActionResult, BookRequest, CheckRequest, EmailSendRequest, Report, SectionKey, SlotOffer, StepEvent, StreamEvent,
} from '@contract/types';
import { mockStream } from '@contract/mock-stream';
import { FIXTURES, findFixture } from './fixtures';
import type { Result, RunOptions } from './index';
import { LOCALE } from '../lib/format';

const STEP_SECTION: Record<string, SectionKey> = {
  roll: 'ledger', permits: 'ledger', trade_permits: 'systems', complaints: 'cases', planning: 'cases',
  zoning: 'upside', money: 'costs', tenants: 'tenants', nearby: 'nearby', hazards: 'hazards', packet: 'packet',
};

function pick(listingText: string): { report: Report; steps: StepEvent[] } | null {
  return findFixture(listingText);
}

function byId(id: string) { return FIXTURES.find((f) => f.report.id === id) ?? null; }

function withFailure(report: Report, steps: StepEvent[], failStep: string): Report {
  const step = steps.find((s) => s.id === failStep);
  const key = STEP_SECTION[failStep];
  if (!step || !key) return report;
  return {
    ...report,
    sections: { ...report.sections, [key]: { state: 'error', source: step.title.replace(/^(Read|Checked|Found) (the )?/, ''), retryable: true } },
  };
}

export async function* runCheck(req: CheckRequest, opts: RunOptions): AsyncGenerator<StreamEvent> {
  const text = req.listingText.trim();
  if (text.length < 4) { yield { type: 'error', error: { kind: 'invalid', retryable: false, field: 'listingText' } }; return; }
  const f = pick(text);
  if (!f) { yield { type: 'error', error: { kind: 'outside_sf', retryable: false, field: 'listingText' } }; return; }
  let report = withLog(f.report);
  if (opts.failStep) report = withFailure(report, f.steps, opts.failStep);
  for await (const ev of mockStream(report, f.steps, { failStep: opts.failStep, speed: 1 })) {
    if (opts.signal?.aborted) return;
    yield ev;
  }
}

export async function getReport(id: string): Promise<Result<Report>> {
  await wait(120);
  const f = byId(id);
  if (!f) return { ok: false, error: { kind: 'not_found', retryable: false } };
  return { ok: true, value: withLog(f.report) };
}

export async function sendEmail(req: EmailSendRequest): Promise<ActionResult> {
  await wait(400);
  if (sentKeys().includes(req.idempotencyKey)) return { ok: true, entry: logOf(req.reportId).find((e) => e.id === req.idempotencyKey)! };
  const entry: ActionLogEntry = {
    id: req.idempotencyKey, kind: req.kind, unknownIds: req.unknownIds, at: new Date().toISOString(),
    summary: req.kind === 'email_city' ? 'Emailed the city. Saved to outbox (demo)' : 'Emailed the listing agent. Saved to outbox (demo)',
    to: req.to,
  };
  append(req.reportId, entry);
  return { ok: true, entry };
}

export async function getSlots(reportId: string, unknownId: string): Promise<Result<SlotOffer>> {
  await wait(300);
  const f = byId(reportId);
  const u = f?.report.unknowns.find((x) => x.id === unknownId);
  const specialist = u?.specialist ?? 'licensed home inspector';
  return {
    ok: true,
    value: {
      provider: `Example ${specialist}`, specialist, scope: u?.title ?? 'A site visit',
      priceUsd: 650, paidPlacement: false, slots: nextSlots(),
    },
  };
}

export async function book(req: BookRequest): Promise<ActionResult> {
  await wait(500);
  const f = byId(req.reportId);
  const u = f?.report.unknowns.find((x) => x.id === req.unknownId);
  const when = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(req.slot));
  const entry: ActionLogEntry = {
    id: req.idempotencyKey, kind: 'book_specialist', unknownIds: [req.unknownId], at: new Date().toISOString(),
    summary: `Sent a visit request to a ${u?.specialist ?? 'specialist'} for ${when}. Saved to outbox (demo)`,
  };
  append(req.reportId, entry);
  return { ok: true, entry };
}

/* ---------- local action log so a refresh shows what was sent ---------- */

function key(id: string) { return `hc-mock-log-${id}`; }
function logOf(id: string): ActionLogEntry[] {
  try { return JSON.parse(sessionStorage.getItem(key(id)) ?? '[]') as ActionLogEntry[]; } catch { return []; }
}
function sentKeys(): string[] {
  const out: string[] = [];
  for (const f of FIXTURES) for (const e of logOf(f.report.id)) out.push(e.id);
  return out;
}
function append(id: string, e: ActionLogEntry) {
  try { sessionStorage.setItem(key(id), JSON.stringify([...logOf(id), e])); } catch { /* storage blocked: the entry still shows until refresh */ }
}
function withLog(r: Report): Report {
  const log = typeof window === 'undefined' ? [] : logOf(r.id);
  return log.length ? { ...r, actions: [...r.actions, ...log] } : r;
}

function nextSlots(): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < 6) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    for (const h of [9, 13]) { const s = new Date(d); s.setHours(h, 0, 0, 0); out.push(s.toISOString()); }
  }
  return out;
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
