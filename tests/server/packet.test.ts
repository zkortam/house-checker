import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { offline, FIXED } from './helpers';
import { DEMO_LISTINGS } from '../../src/server/demo-listings';
import type { StreamEvent } from '../../src/contract/types';
import { checkCitations, checkCopy } from '../../src/contract/copy';

beforeAll(() => offline());

describe('disclosure packet (A12)', () => {
  it('stores a PDF, reads it and reconciles at least one claim with a page citation', async () => {
    const { storePacket } = await import('../../src/server/packet');
    const { runCheck } = await import('../../src/server/pipeline');
    const bytes = readFileSync(path.join(import.meta.dirname, 'fixtures', 'sample-packet.pdf'));
    const stored = await storePacket(new Uint8Array(bytes), 'sample-packet.pdf');
    if (!('packetFileId' in stored)) throw new Error(stored.debug);
    const events: StreamEvent[] = [];
    const report = await runCheck(DEMO_LISTINGS[0].text, (e) => { events.push(e); }, { ...FIXED, save: false, packetFileId: stored.packetFileId });
    expect(events.filter((e) => e.type === 'step' && e.id === 'packet').map((e) => (e as { status: string }).status)).toEqual(['running', 'done']);
    expect(report!.ledger.some((r) => r.title.startsWith('Packet'))).toBe(false); // the ledger stays listing vs city
    const summary = report!.packet!;
    expect(summary.pages).toBe(2);
    expect(summary.findings.find((f) => f.topic === 'baths')).toMatchObject({ doc: 'spq', page: 1, label: 'records_differ', records: '4' });
    expect(summary.findings.find((f) => f.topic === 'sqft')).toMatchObject({ doc: 'inspection', page: 2, label: 'matches' });
    const pageSrc = report!.sources.find((s) => /^packet:pk-[a-f0-9]+:p1$/.test(s.id));
    expect(pageSrc).toMatchObject({ page: 1, url: null });
    expect(report!.sections.packet).toEqual({ state: 'ok' });
    const rows = summary.findings;
    for (const r of rows) { expect(checkCopy(r.text)).toEqual([]); expect(checkCopy(r.statement, { maxLength: 90 })).toEqual([]); expect(checkCitations(r.text, report!.sources.length)).toEqual([]); }
  });

  it('rejects a file that is not a PDF', async () => {
    const { storePacket } = await import('../../src/server/packet');
    expect(await storePacket(new TextEncoder().encode('hello'))).toMatchObject({ error: 'invalid' });
  });
});
