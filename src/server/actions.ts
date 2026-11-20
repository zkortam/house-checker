import { randomBytes } from 'node:crypto';
import type { ActionLogEntry, ActionResult, ApiError, BookRequest, EmailSendRequest, Report, SlotOffer, Unknown } from '../contract/types';
import { checkCopy } from '../contract/copy';
import { EMAIL_RE, emailMode, sendEmail } from './email';
import { appendAction, getReport, idempotent } from './store';
import { sensoAfterAction } from './sponsors/senso';

/** A11: email the listing agent or the city, offer specialist slots, and send a specialist request with an .ics invite. */

const err = (kind: ApiError['kind'], extra: Partial<ApiError> = {}): ActionResult => ({ ok: false, error: { kind, retryable: false, ...extra } });
const entryId = () => `act-${randomBytes(4).toString('hex')}`;

export async function emailAction(req: Partial<EmailSendRequest>): Promise<ActionResult> {
  if (!req || !req.reportId || !req.idempotencyKey || !req.subject || !req.body || !req.kind) return err('invalid', { debug: 'missing fields' });
  if (!req.to || !EMAIL_RE.test(req.to.trim())) return err('invalid', { field: 'to' });
  if (req.kind !== 'email_listing_agent' && req.kind !== 'email_city') return err('invalid', { debug: 'bad kind' });
  const report = await getReport(req.reportId);
  if (!report) return err('not_found');
  const r = req as EmailSendRequest;
  return idempotent<ActionResult>('email', `${r.reportId}__${r.idempotencyKey}`, async () => {
    const sent = await sendEmail({
      to: [r.to.trim()], subject: r.subject.slice(0, 200), text: r.body.slice(0, 10_000), idempotencyKey: r.idempotencyKey,
      ...(process.env.BUYER_EMAIL ? { cc: [process.env.BUYER_EMAIL], replyTo: process.env.BUYER_EMAIL } : {}),
    });
    if (!sent.ok) throw Object.assign(new Error(sent.reason), { retryable: sent.retryable });
    const who = r.kind === 'email_city' ? 'the city' : 'the listing agent';
    const entry: ActionLogEntry = {
      id: entryId(), kind: r.kind, unknownIds: r.unknownIds ?? [], at: new Date().toISOString(),
      summary: sent.mode === 'outbox' ? `Saved to outbox (demo): email to ${who}` : `Emailed ${who}`, to: r.to.trim(),
    };
    sensoAfterAction(await appendAction(r.reportId, entry), entry);
    return { ok: true, entry };
  }).catch((e: Error & { retryable?: boolean }) => err('unavailable', { retryable: e.retryable ?? true, reference: randomBytes(4).toString('hex').toUpperCase(), debug: e.message }));
}

/* ---------- slots ---------- */

const TZ = 'America/Los_Angeles';

function tzOffset(d: Date): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-08:00';
  const m = part.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? '00'}` : '-08:00';
}

/** Next weekdays at 9 AM and 1 PM Pacific, starting tomorrow. */
export function makeSlots(now = new Date(), days = 3): string[] {
  const out: string[] = [];
  const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dow = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  for (let i = 1; out.length < days * 2 && i < 14; i++) {
    const d = new Date(now.getTime() + i * 86400_000);
    if (['Sat', 'Sun'].includes(dow(d))) continue;
    const date = ymd(d);
    const off = tzOffset(new Date(`${date}T12:00:00Z`));
    out.push(`${date}T09:00:00${off}`, `${date}T13:00:00${off}`);
  }
  return out;
}

const PRICES: Record<string, number> = { 'structural engineer': 750, 'sewer lateral inspector': 350, 'general home inspector': 650, 'pest inspector': 250, 'electrician': 300 };

function scopeOf(u: Unknown | undefined, report: Report): string {
  const why = (u?.why ?? '').replace(/\s*\[\d+\]/g, '').trim();
  return why ? `${u!.title} ${why}` : `Site visit at ${report.address} covering the open questions in this report.`;
}

export async function slotsFor(reportId: string | null, unknownId: string | null, now = new Date()): Promise<SlotOffer | ApiError> {
  if (!reportId) return { kind: 'invalid', retryable: false };
  const report = await getReport(reportId);
  if (!report) return { kind: 'not_found', retryable: false };
  const u = report.unknowns.find((x) => x.id === unknownId) ?? report.unknowns.find((x) => x.action === 'book_specialist');
  const specialist = u?.specialist ?? 'general home inspector';
  return {
    provider: `Example ${specialist}`,
    specialist,
    scope: scopeOf(u, report),
    priceUsd: PRICES[specialist] ?? null,
    paidPlacement: false,
    slots: makeSlots(now),
  };
}

/* ---------- booking: a request email with an .ics invite ---------- */

function icsDate(iso: string): string { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function icsEscape(s: string): string { return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }

export function buildIcs(opts: { uid: string; start: string; minutes: number; summary: string; description: string; location: string; organizer?: string; attendee?: string }): string {
  const end = new Date(new Date(opts.start).getTime() + opts.minutes * 60_000).toISOString();
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//House Checker//Specialist request//EN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${opts.uid}`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(opts.start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(opts.summary)}`, `DESCRIPTION:${icsEscape(opts.description)}`, `LOCATION:${icsEscape(opts.location)}`,
    ...(opts.organizer ? [`ORGANIZER:mailto:${opts.organizer}`] : []),
    ...(opts.attendee ? [`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${opts.attendee}`] : []),
    'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

export function slotLabel(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d);
  return `${date}, ${time}`;
}

export async function bookAction(req: Partial<BookRequest>, now = new Date()): Promise<ActionResult> {
  if (!req || !req.reportId || !req.unknownId || !req.idempotencyKey) return err('invalid', { debug: 'missing fields' });
  if (!req.slot || Number.isNaN(Date.parse(req.slot))) return err('invalid', { field: 'slot' });
  const report = await getReport(req.reportId);
  if (!report) return err('not_found');
  const offer = await slotsFor(req.reportId, req.unknownId, now);
  if ('kind' in offer) return err(offer.kind);
  if (!offer.slots.some((s) => Date.parse(s) === Date.parse(req.slot!))) return err('invalid', { field: 'slot', debug: 'slot not offered' });
  const r = req as BookRequest;
  return idempotent<ActionResult>('book', `${r.reportId}__${r.idempotencyKey}`, async () => {
    const when = slotLabel(r.slot);
    const to = process.env.SPECIALIST_EMAIL || 'specialist@example.com';
    const buyer = process.env.BUYER_EMAIL;
    const ics = buildIcs({
      uid: `${r.reportId}-${r.unknownId}-${r.idempotencyKey}@house-checker`, start: r.slot, minutes: 90,
      summary: `${offer.specialist[0].toUpperCase()}${offer.specialist.slice(1)} visit, ${report.address}`,
      description: `${offer.scope}\nRequested through House Checker. No paid placement.`,
      location: `${report.address}, San Francisco, CA`, organizer: process.env.RESEND_FROM?.match(/[\w.+-]+@[\w.-]+/)?.[0], attendee: to,
    });
    const text = `Hello,\n\nI'm considering buying ${report.address}, San Francisco, and would like a ${offer.specialist} to visit on ${when} (Pacific).\n\nWhat I need checked: ${offer.scope}\n\nThe calendar invite is attached. If that time doesn't work, could you reply with one that does?\n\nThanks,\n`;
    const sent = await sendEmail({
      to: [to], ...(buyer ? { cc: [buyer], replyTo: buyer } : {}), subject: `Site visit request: ${report.address}, ${when}`, text,
      attachments: [{ filename: 'visit.ics', content: ics, contentType: 'text/calendar; method=REQUEST' }], idempotencyKey: `book-${r.idempotencyKey}`,
    });
    if (!sent.ok) throw Object.assign(new Error(sent.reason), { retryable: sent.retryable });
    const summary = `${sent.mode === 'outbox' ? 'Saved to outbox (demo): requested' : 'Requested'} a ${offer.specialist} for ${when}`;
    const entry: ActionLogEntry = { id: entryId(), kind: 'book_specialist', unknownIds: [r.unknownId], at: new Date().toISOString(), summary: checkCopy(summary).length ? `Requested a ${offer.specialist}` : summary, to };
    sensoAfterAction(await appendAction(r.reportId, entry), entry);
    return { ok: true, entry };
  }).catch((e: Error & { retryable?: boolean }) => err('unavailable', { retryable: e.retryable ?? true, reference: randomBytes(4).toString('hex').toUpperCase(), debug: e.message }));
}

export { emailMode };
