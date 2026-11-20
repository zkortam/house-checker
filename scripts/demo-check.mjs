#!/usr/bin/env node
// Headless demo check: runs the PLAN.md demo flow against a running server (npm run start).
// Usage: node scripts/demo-check.mjs [baseUrl]
// For each demo listing: POST /api/check (SSE), assert the event order, GET the stored report,
// send the listing-agent email, and (when the report has a specialist unknown) request a specialist.
const base = process.argv[2] ?? 'http://localhost:3000';

const LISTINGS = [
  'Example listing: 2055 42nd Ave, San Francisco. Fully remodeled Sunset home with a legal in-law. 2 units, 3 bed, 4 bath, about 2,000 sq ft. Offered at $1,595,000.',
  'Example listing: 57 Carmelita St, San Francisco. Duboce Park Victorian, fully renovated 2026. 3 bed, 3 bath, about 2,700 sq ft, garden in-law. Offered at $3,295,000.',
];

let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };
const ok = (msg) => console.log(`  ok   ${msg}`);

async function check(listingText) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/check`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ listingText }),
  });
  if (!res.ok || !res.body) { fail(`POST /api/check ${res.status}`); return null; }
  const events = [];
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line.startsWith('data:')) { try { events.push(JSON.parse(line.slice(5))); } catch { fail(`bad SSE line ${line.slice(0, 80)}`); } }
    }
  }
  const types = events.map((e) => e.type);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (types[0] !== 'run') fail(`first event ${types[0]}`); else ok(`run ${events[0].reportId}`);
  const steps = events.filter((e) => e.type === 'step');
  const failed = steps.filter((s) => s.status === 'failed');
  ok(`${steps.length} step events, ${failed.length} failed${failed.length ? ': ' + failed.map((s) => s.id).join(', ') : ''}`);
  const err = events.find((e) => e.type === 'error');
  if (err) fail(`error event ${JSON.stringify(err.error)}`);
  if (types.at(-1) !== 'done') fail(`stream ended with ${types.at(-1)} (no done)`); else ok(`done in ${secs} s`);
  const rep = events.find((e) => e.type === 'report');
  if (!rep) { fail('no report event'); return null; }
  return rep.report;
}

async function main() {
  for (const text of LISTINGS) {
    console.log(`\n# ${text.slice(17, 50)}`);
    const report = await check(text);
    if (!report) continue;
    ok(`decision: ${report.decision?.tone} "${report.decision?.title}"`);
    ok(`ledger: ${report.ledger.map((r) => `${r.key}=${r.label}`).join(' ')}`);
    ok(`cases ${report.cases.length}, unknowns ${report.unknowns.length}, sources ${report.sources.length}`);

    const g = await fetch(`${base}/api/check/${encodeURIComponent(report.id)}`);
    if (g.ok) ok(`GET /api/check/${report.id}`); else fail(`GET report ${g.status}`);

    const draft = report.drafts?.listingAgentEmail;
    if (draft) {
      const body = { reportId: report.id, unknownIds: draft.unknownIds, kind: 'email_listing_agent', to: draft.to ?? 'demo-agent@example.com',
        subject: draft.subject, body: draft.body, idempotencyKey: `demo-${report.id}-${Date.now()}` };
      const r = await fetch(`${base}/api/actions/email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (j?.ok) ok(`email: ${j.entry.summary}`); else fail(`email ${r.status} ${JSON.stringify(j)}`);
      const again = await fetch(`${base}/api/actions/email`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j2 = await again.json().catch(() => null);
      ok(`repeat key -> ${JSON.stringify(j2?.entry?.id === j?.entry?.id ? 'same entry' : j2)}`);
    }

    const spec = report.unknowns.find((u) => u.action === 'book_specialist');
    if (spec) {
      const s = await fetch(`${base}/api/slots?report=${encodeURIComponent(report.id)}&unknown=${encodeURIComponent(spec.id)}`);
      const offer = await s.json().catch(() => null);
      if (!offer?.slots?.length) { fail(`slots ${s.status} ${JSON.stringify(offer)}`); continue; }
      ok(`slots: ${offer.slots.length} for ${offer.specialist}`);
      const b = await fetch(`${base}/api/actions/book`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, unknownId: spec.id, slot: offer.slots[0], idempotencyKey: `demo-book-${report.id}-${Date.now()}` }) });
      const bj = await b.json().catch(() => null);
      if (bj?.ok) ok(`specialist: ${bj.entry.summary}`); else fail(`book ${b.status} ${JSON.stringify(bj)}`);
    }

    const after = await (await fetch(`${base}/api/check/${encodeURIComponent(report.id)}`)).json().catch(() => null);
    ok(`action log after refresh: ${after?.actions?.length ?? 'missing'}`);
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
