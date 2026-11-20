import { randomBytes } from 'node:crypto';
import type { ApiError, Glyph, Report, StepEvent, StreamEvent } from '../contract/types';
import { parseAddress, parcelDisplay, resolveAddress, type ResolvedAddress } from './address';
import { readListing } from './listing';
import { buildReport, fmtDate, type StepKey } from './rules';
import { fetchers, type Raw } from './sources';
import { saveReport, trackRun } from './store';
import { writeProse } from './writer';
import { FetchError } from './http';
import { sensoAfterReport } from './sponsors/senso';
import { readPermits } from './permit-reader';
import { loadPacket, readPacketFacts, reconcilePacket, type PacketSummaryOut } from './packet';

/**
 * The run: listing -> parcel -> parallel fetchers (each a live step) -> rules -> writer -> report.
 * Emits StreamEvents in contract order: run, steps (running, then done or failed), progress, delta words,
 * report, done. `error` ends a run that can't produce a report.
 */

type Emit = (e: StreamEvent) => void | Promise<void>;

const STEPS: Record<Exclude<StepKey, 'zoning'> | 'packet', { glyph: Glyph; title: string }> = {
  parcel: { glyph: 'parcel', title: 'Found the parcel' },
  roll: { glyph: 'roll', title: "Read the assessor's roll" },
  permits: { glyph: 'permit', title: 'Read building permits' },
  trade_permits: { glyph: 'plumbing', title: 'Read plumbing and electrical permits' },
  complaints: { glyph: 'complaint', title: 'Read complaints and notices of violation' },
  planning: { glyph: 'planning', title: 'Read Planning records' },
  tenants: { glyph: 'tenants', title: 'Read tenant buyouts and business registrations' },
  hazards: { glyph: 'hazard', title: 'Checked hazard zones' },
  nearby: { glyph: 'nearby', title: 'Read projects nearby' },
  money: { glyph: 'money', title: 'Worked out taxes and fees' },
  packet: { glyph: 'packet', title: 'Read the disclosure packet' },
};
const FAIL_REASON: Record<string, string> = {
  roll: "Couldn't reach the assessor's roll", permits: "Couldn't reach DBI permits", trade_permits: "Couldn't reach DBI plumbing and electrical permits",
  complaints: "Couldn't reach DBI complaints", planning: "Couldn't reach Planning records", tenants: "Couldn't reach Rent Board buyouts",
  hazards: "Couldn't reach the hazard maps", nearby: "Couldn't reach Planning projects nearby",
};

export function newReportId(address: string): string {
  const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${randomBytes(3).toString('hex')}`;
}

function step(id: keyof typeof STEPS, status: StepEvent['status'], extra: Partial<StepEvent> = {}): StepEvent {
  return { type: 'step', id, glyph: STEPS[id].glyph, title: STEPS[id].title, status, ...extra };
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export interface RunOpts { packetFileId?: string; now?: Date; closing?: Date; reportId?: string; save?: boolean; write?: boolean; signal?: AbortSignal }

export async function runCheck(listingText: string, emit: Emit, opts: RunOpts = {}): Promise<Report | null> {
  const fail = async (error: ApiError) => { await emit({ type: 'error', error }); return null; };
  const listing = await readListing(listingText);
  if (!listing.ok) return fail({ kind: listing.kind, retryable: false, field: 'listingText' });
  const fromText = parseAddress(listingText);
  const parsed = fromText && fromText.display === listing.claims.address ? fromText : listing.claims.address ? parseAddress(listing.claims.address) : null;
  if (!parsed) return fail({ kind: 'invalid', retryable: false, field: 'listingText', debug: 'no address in listing' });

  let addr: ResolvedAddress | null;
  try {
    addr = await resolveAddress(parsed);
  } catch (e) {
    const kind = e instanceof FetchError && e.kind === 'timeout' ? 'timeout' : 'unavailable';
    return fail({ kind, retryable: true, reference: randomBytes(4).toString('hex').toUpperCase(), debug: String((e as Error).message) });
  }
  if (!addr || !addr.parcels.length) return fail({ kind: 'not_found', retryable: false, field: 'listingText', debug: `no parcel for ${parsed.display}` });

  const reportId = opts.reportId ?? newReportId(addr.display);
  let settle: (r: Report | null) => void = () => {};
  if (opts.save !== false) trackRun(reportId, new Promise<Report | null>((r) => { settle = r; }));
  try {
    const report = await finishRun(reportId, addr, listing, listingText, emit, opts);
    settle(report);
    return report;
  } catch (e) {
    settle(null);
    throw e;
  }
}

async function finishRun(reportId: string, addr: ResolvedAddress, listing: Extract<Awaited<ReturnType<typeof readListing>>, { ok: true }>, listingText: string, emit: Emit, opts: RunOpts): Promise<Report> {
  await emit({ type: 'run', runId: `run-${randomBytes(4).toString('hex')}`, reportId, address: addr.display });

  const packet = opts.packetFileId ? await loadPacket(opts.packetFileId) : null;
  const order: Array<keyof typeof STEPS> = ['parcel', 'roll', 'permits', 'trade_permits', 'complaints', 'planning', 'tenants', 'hazards', 'nearby', 'money', ...(opts.packetFileId ? ['packet' as const] : [])];
  for (const id of order) await emit(step(id, 'running'));
  const units = addr.units.filter((u) => !u.includes('#')).slice(0, 2);
  await emit(step('parcel', 'done', { detail: [parcelDisplay(addr.parcels), ...units].join(units.length ? ' and ' : '').replace(/ and (.*) and /, ', $1 and ') }));

  const raw: Partial<Raw> = {};
  const failed = new Set<StepKey>();
  const a = addr;
  const run = async <T>(id: keyof typeof STEPS, fn: () => Promise<T>, detail: (v: T) => string, apply: (v: T) => void) => {
    try {
      const v = await fn();
      apply(v);
      await emit(step(id, 'done', { detail: detail(v) }));
    } catch (e) {
      failed.add(id as StepKey);
      if (process.env.HC_DEBUG) console.warn('[step failed]', id, (e as Error).message);
      await emit(step(id, 'failed', { reason: FAIL_REASON[id] ?? `Couldn't reach ${STEPS[id].title}`, retryable: true }));
    }
  };

  await Promise.all([
    run('roll', () => fetchers.roll(a), (v) => (v[0]?.closed_roll_year ? `As of ${fmtDate(`${v[0].closed_roll_year}-01-01`)}` : 'No roll record'), (v) => { raw.roll = v; }),
    run('permits', async () => {
      const [p, z, lin] = await Promise.all([fetchers.permits(a), fetchers.zoning(a).catch(() => { failed.add('zoning'); return { zoning: [], historic: [] }; }),
        fetchers.lineage(a).catch(() => ({ lineage: [], parentPermits: [] }))]);
      let last = -1;
      const permitFacts = await readPermits(p.permits, (done, total) => {
        if (done === last || done >= total) return;
        last = done;
        void emit(step('permits', 'running', { detail: `Read ${done} of ${total} permits` }));
      });
      return { ...p, ...z, ...lin, permitFacts };
    }, (v) => { const open = v.permits.filter((p) => /issued|filed/i.test(p.status ?? '') && !p.completed_date).length; return open && open === v.permits.filter((p) => !/cancel|withdraw|expired/i.test(p.status ?? '')).length ? plural(open, 'open permit') : plural(v.permits.length, 'permit'); }, (v) => { Object.assign(raw, v); }),
    run('trade_permits', () => fetchers.trade(a), (v) => {
      const finals = v.plumbing.filter((p) => p.completed_date && /bath/i.test(p.description ?? '')).length;
      const issued = [...v.plumbing, ...v.electrical].filter((p) => !p.completed_date).length;
      return finals ? plural(finals, 'plumbing final') : issued ? `${issued} issued, none final` : plural(v.plumbing.length + v.electrical.length, 'permit');
    }, (v) => { Object.assign(raw, v); }),
    run('complaints', () => fetchers.complaints(a), (v) => {
      const act = v.complaints.filter((c) => /^active/i.test(c.status ?? '')).length;
      return act ? `${act} active` : v.complaints.length ? `${plural(v.complaints.length, 'complaint')}, all closed` : 'None on file';
    }, (v) => { Object.assign(raw, v); }),
    run('planning', () => fetchers.planning(a), (v) => plural(v.planning.length + v.planningProjects.length, 'record'), (v) => { Object.assign(raw, v); }),
    run('tenants', () => fetchers.tenants(a), (v) => (v.buyouts.length || v.hotelTax.length ? [v.buyouts.length ? plural(v.buyouts.length, 'buyout') : '', v.hotelTax.length ? plural(v.hotelTax.length, 'hotel-tax registration') : ''].filter(Boolean).join(', ') : 'None found'), (v) => { Object.assign(raw, v); }),
    run('hazards', () => fetchers.hazards(a), (h) => {
      const notes = [h.femaZone && /^(A|V)/.test(h.femaZone), h.stormFlood, h.liquefaction, h.landslideZone || (h.landslideClass ?? 0) >= 7, h.tsunami, h.seaLevel, (h.reservoirs ?? []).length > 0, h.maher].filter(Boolean).length;
      return `8 maps, ${plural(notes, 'zone')}`;
    }, (v) => { raw.hazards = v; }),
    run('nearby', () => fetchers.nearby(a), (v) => (v.nearbyProjects.length ? `${plural(v.nearbyProjects.length, 'project')} within 150 m` : 'Nothing within 150 m'), (v) => { Object.assign(raw, v); }),
  ]);

  const now = opts.now ?? new Date();
  let report = buildReport({ listingText, claims: listing.claims, agentEmail: listing.agentEmail, addr: a, raw, failed, now, reportId, closing: opts.closing });
  if (opts.packetFileId) {
    if (!packet) {
      report.sections.packet = { state: 'error', source: 'Disclosure packet', retryable: false };
      await emit(step('packet', 'failed', { reason: "Couldn't read the disclosure packet", retryable: false }));
    } else {
      try {
        const facts = await readPacketFacts(packet.pages);
        const { rows, sources, findings } = reconcilePacket(report, facts, opts.packetFileId, packet.pages);
        const summary: PacketSummaryOut = { fileName: packet.filename ?? null, pages: packet.pages.length, findings };
        const next: Report & { packet: PacketSummaryOut } = { ...report, ledger: [...report.ledger, ...rows], sources: [...report.sources, ...sources], packet: summary,
          sections: { ...report.sections, packet: rows.length ? { state: 'ok' } : { state: 'empty', text: 'The packet states no counts to compare' } } };
        report = next;
        await emit(step('packet', 'done', { detail: `${packet.pages.length} pages, ${rows.length} claim${rows.length === 1 ? '' : 's'} compared` }));
      } catch (e) {
        report.sections.packet = { state: 'error', source: 'Disclosure packet', retryable: true };
        await emit(step('packet', 'failed', { reason: "Couldn't read the disclosure packet", retryable: true }));
      }
    }
  }
  await emit(step('money', 'done', { detail: listing.claims.price ? 'At the asking price' : 'At the assessed value' }));
  // Progress only once no step is running.
  await emit({ type: 'progress', text: 'Comparing with the listing' });
  if (opts.write !== false) report = await writeProse(report);
  for (const word of report.answer.split(/(?<= )/)) await emit({ type: 'delta', text: word });
  if (opts.save !== false) await saveReport(report);
  if (opts.save !== false) sensoAfterReport(report);
  await emit({ type: 'report', report });
  await emit({ type: 'done' });
  return report;
}
