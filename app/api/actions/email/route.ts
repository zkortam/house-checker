import { emailAction } from '@/server/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/actions/email: EmailSendRequest -> ActionResult. Sends at most once per idempotencyKey. */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const result = await emailAction(body ?? {});
  const status = result.ok ? 200 : result.error.kind === 'not_found' ? 404 : result.error.kind === 'invalid' ? 400 : 503;
  return Response.json(result, { status });
}
