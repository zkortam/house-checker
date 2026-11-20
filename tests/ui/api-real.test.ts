import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockStream } from '@contract/mock-stream';
import { report2055, steps2055 } from '@contract/fixtures';
import type { StreamEvent } from '@contract/types';
import { MOCK, getReport, runCheck, sendEmail } from '@/ui/api';

async function collect<T>(g: AsyncGenerator<T>): Promise<T[]> { const out: T[] = []; for await (const x of g) out.push(x); return out; }

function sseResponse(events: StreamEvent[], chunk = 37): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) { if (i >= bytes.length) { c.close(); return; } c.enqueue(bytes.slice(i, i + chunk)); i += chunk; },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('real transport (NEXT_PUBLIC_MOCK unset)', () => {
  it('is not in mock mode under test', () => { expect(MOCK).toBe(false); });

  it('parses the /api/check SSE stream into the same events as mockStream, across odd chunk boundaries', async () => {
    const expected = await collect(mockStream(report2055, steps2055, { speed: 1000 }));
    const fetchMock = vi.fn(async () => sseResponse(expected));
    vi.stubGlobal('fetch', fetchMock);
    const got = await collect(runCheck({ listingText: report2055.listing.text }));
    expect(got).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledWith('/api/check', expect.objectContaining({ method: 'POST' }));
  });

  it('turns a network failure into an offline error event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    const got = await collect(runCheck({ listingText: 'x' }));
    expect(got).toEqual([{ type: 'error', error: { kind: 'offline', retryable: true } }]);
  });

  it('maps GET /api/check/[id] not_found to an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ kind: 'not_found', retryable: false }), { status: 404 })));
    const r = await getReport('nope');
    expect(r).toEqual({ ok: false, error: { kind: 'not_found', retryable: false } });
  });

  it('returns the stored report from GET /api/check/[id]', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(report2055), { status: 200 })));
    const r = await getReport(report2055.id);
    expect(r.ok && r.value.id).toBe(report2055.id);
  });

  it('passes ActionResult through from POST /api/actions/email', async () => {
    const entry = { id: 'k1', kind: 'email_listing_agent', unknownIds: [], at: '2026-11-20T00:00:00Z', summary: 'Emailed the listing agent' };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, entry }), { status: 200 })));
    const r = await sendEmail({ reportId: 'r', unknownIds: [], kind: 'email_listing_agent', to: 'a@b.co', subject: 's', body: 'b', idempotencyKey: 'k1' });
    expect(r).toEqual({ ok: true, entry });
  });
});
