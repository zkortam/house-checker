import { bookAction } from '@/server/actions';
import { emailMode } from '@/server/email';
import { clientIp, overLimit } from '@/server/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/actions/book: BookRequest -> ActionResult. A specialist request email with an .ics invite. */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const wait = emailMode() === 'resend' ? overLimit(clientIp(req)) : null;
  if (wait) return Response.json({ ok: false, error: { kind: 'rate', retryable: true, retryAfterSec: wait } }, { status: 429 });
  const result = await bookAction(body ?? {});
  const status = result.ok ? 200 : result.error.kind === 'not_found' ? 404 : result.error.kind === 'invalid' ? 400 : 503;
  return Response.json(result, { status });
}
