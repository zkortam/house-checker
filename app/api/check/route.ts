import type { CheckRequest, StreamEvent } from '@contract/types';
import { runCheck } from '@/server/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST /api/check: CheckRequest in, text/event-stream of StreamEvent out (one JSON object per data: line). */
export async function POST(req: Request): Promise<Response> {
  let body: Partial<CheckRequest> = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const listingText = typeof body.listingText === 'string' ? body.listingText.slice(0, 20_000) : '';
  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { closed = true; }
      };
      const ping = setInterval(() => { if (!closed) try { controller.enqueue(enc.encode(': ping\n\n')); } catch { closed = true; } }, 10_000);
      try {
        if (!listingText.trim()) emit({ type: 'error', error: { kind: 'invalid', retryable: false, field: 'listingText' } });
        else await runCheck(listingText, emit, { packetFileId: typeof body.packetFileId === 'string' ? body.packetFileId : undefined });
      } catch (e) {
        emit({ type: 'error', error: { kind: 'unavailable', retryable: true, reference: Math.random().toString(36).slice(2, 10).toUpperCase(), debug: String((e as Error)?.message ?? e) } });
      } finally {
        clearInterval(ping);
        if (!closed) { closed = true; try { controller.close(); } catch { /* already closed */ } }
      }
    },
    cancel() { closed = true; },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' },
  });
}
