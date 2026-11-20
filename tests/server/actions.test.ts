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

describe('Senso sponsor (A13)', () => {
  it('is off without a key and builds cited context with one', async () => {
    const { sensoEnabled, reportContext } = await import('../../src/server/sponsors/senso');
    delete process.env.SENSO_API_KEY;
    expect(sensoEnabled()).toBe(false);
    const { report } = await run(DEMO_LISTINGS[0].text);
    const ctx = reportContext(report!);
    expect(ctx.title).toContain('2055 42nd Ave');
    expect(ctx.text).toContain('[1] ');
    expect(ctx.text).not.toMatch(/undefined/);
  });
});

describe('refresh mid-run', () => {
  it('GET waits for an in-flight run instead of returning not_found', async () => {
    const { runCheck } = await import('../../src/server/pipeline');
    const { getReportOrWait, getReport } = await import('../../src/server/store');
    let id = '';
    const done = runCheck(DEMO_LISTINGS[5].text, (e) => { if (e.type === 'run') id = e.reportId; }, { now: new Date('2026-11-20T22:00:00Z') });
    while (!id) await new Promise((r) => setTimeout(r, 1));
    const waited = getReportOrWait(id, 10_000);
    await done;
    expect((await waited)?.id).toBe(id);
    expect((await getReport(id))?.id).toBe(id);
    expect(await getReportOrWait('nope', 10)).toBeNull();
  });
});

describe('Resend path (mock server)', () => {
  it('sends real recipients with base64 attachments, keeps placeholders and refusals in the outbox', async () => {
    const { createServer } = await import('node:http');
    const seen: Array<{ auth?: string; key?: string; body: any }> = [];
    let status = 200;
    const server = createServer((req, res) => {
      let b = '';
      req.on('data', (d) => { b += d; });
      req.on('end', () => {
        seen.push({ auth: req.headers.authorization, key: req.headers['idempotency-key'] as string, body: JSON.parse(b) });
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(status === 200 ? { id: 'em_1' } : { message: 'You can only send testing emails to your own email address' }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    const env = { ...process.env };
    Object.assign(process.env, { RESEND_API_KEY: 're_test', RESEND_FROM: 'House Checker <hc@demo.dev>', RESEND_BASE_URL: `http://127.0.0.1:${port}` });
    try {
      const { sendEmail } = await import('../../src/server/email');
      const sent = await sendEmail({ to: ['buyer@realmail.dev'], subject: 's', text: 't', idempotencyKey: 'k1', attachments: [{ filename: 'visit.ics', content: 'BEGIN:VCALENDAR', contentType: 'text/calendar; method=REQUEST' }] });
      expect(sent).toMatchObject({ ok: true, mode: 'resend', id: 'em_1' });
      expect(seen[0]).toMatchObject({ auth: 'Bearer re_test', key: 'k1', body: { from: 'House Checker <hc@demo.dev>', to: ['buyer@realmail.dev'] } });
      expect(Buffer.from(seen[0].body.attachments[0].content, 'base64').toString()).toBe('BEGIN:VCALENDAR');
      expect(await sendEmail({ to: ['specialist@example.com'], subject: 's', text: 't' })).toMatchObject({ ok: true, mode: 'outbox' });
      expect(seen.length).toBe(1);
      status = 403;
      expect(await sendEmail({ to: ['someone@realmail.dev'], subject: 's', text: 't' })).toMatchObject({ ok: true, mode: 'outbox' });
      status = 500;
      expect(await sendEmail({ to: ['someone@realmail.dev'], subject: 's', text: 't' })).toMatchObject({ ok: false, retryable: true });
    } finally {
      for (const k of ['RESEND_API_KEY', 'RESEND_FROM', 'RESEND_BASE_URL']) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
      server.close();
    }
  });
});
