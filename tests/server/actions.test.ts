import { beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { offline, run } from './helpers';
import { DEMO_LISTINGS } from '../../src/server/demo-listings';

beforeAll(() => offline());

describe('actions (outbox mode)', () => {
  it('emails at most once per idempotency key and logs the action on the report', async () => {
    const { emailAction } = await import('../../src/server/actions');
    const { getReport } = await import('../../src/server/store');
    const { report } = await run(DEMO_LISTINGS[0].text, { save: true });
    const req = { reportId: report!.id, unknownIds: ['u-tenants'], kind: 'email_listing_agent' as const, to: 'agent@example.com', subject: 'Questions', body: 'Hi', idempotencyKey: 'k1' };
    const a = await emailAction(req);
    const b = await emailAction(req);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
    const outbox = readdirSync(path.join(process.env.HC_DATA_DIR!, 'outbox'));
    expect(outbox.length).toBe(1);
    expect(a.ok && a.entry.summary).toBe('Saved to outbox (demo): email to the listing agent');
    expect((await getReport(report!.id))!.actions.length).toBe(1);
    const bad = await emailAction({ ...req, to: 'not-an-email', idempotencyKey: 'k2' });
    expect(bad).toMatchObject({ ok: false, error: { kind: 'invalid', field: 'to' } });
  });

  it('offers weekday slots and books a specialist with an .ics invite', async () => {
    const { slotsFor, bookAction } = await import('../../src/server/actions');
    const { report } = await run(DEMO_LISTINGS[1].text, { save: true });
    const now = new Date('2026-11-20T22:00:00Z'); // a Friday
    const offer = await slotsFor(report!.id, 'u-excavation', now);
    if ('kind' in offer) throw new Error('no offer');
    expect(offer.specialist).toBe('structural engineer');
    expect(offer.paidPlacement).toBe(false);
    expect(offer.slots[0]).toBe('2026-11-23T09:00:00-08:00');
    expect(offer.slots[1]).toBe('2026-11-23T13:00:00-08:00');
    const res = await bookAction({ reportId: report!.id, unknownId: 'u-excavation', slot: offer.slots[0], idempotencyKey: 'b1' }, now);
    expect(res.ok).toBe(true);
    expect(res.ok && res.entry.summary).toMatch(/structural engineer for Mon, Nov 23, 9:00/);
    const dir = path.join(process.env.HC_DATA_DIR!, 'outbox');
    const mail = readdirSync(dir).map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'))).find((m) => /Site visit/.test(m.subject));
    expect(mail.attachments[0].content).toMatch(/BEGIN:VCALENDAR[\s\S]*DTSTART:20261123T170000Z/);
    const again = await bookAction({ reportId: report!.id, unknownId: 'u-excavation', slot: offer.slots[0], idempotencyKey: 'b1' }, now);
    expect(again).toEqual(res);
    const badSlot = await bookAction({ reportId: report!.id, unknownId: 'u-excavation', slot: '2026-11-22T03:00:00Z', idempotencyKey: 'b2' }, now);
    expect(badSlot).toMatchObject({ ok: false, error: { kind: 'invalid', field: 'slot' } });
  });
});
