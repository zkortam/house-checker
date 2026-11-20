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
    const rows = report!.ledger.filter((r) => r.title.startsWith('Packet'));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const baths = rows.find((r) => r.title === 'Packet: baths');
    expect(baths).toMatchObject({ listing: '3', records: '4', label: 'records_differ' });
    expect(report!.sources.some((s) => /^packet:pk-[a-f0-9]+:p1$/.test(s.id))).toBe(true);
    expect(report!.sections.packet).toEqual({ state: 'ok' });
    for (const r of rows) { expect(checkCopy(r.why)).toEqual([]); expect(checkCitations(r.why, report!.sources.length)).toEqual([]); }
  });

  it('rejects a file that is not a PDF', async () => {
    const { storePacket } = await import('../../src/server/packet');
    expect(await storePacket(new TextEncoder().encode('hello'))).toMatchObject({ error: 'invalid' });
  });
});
