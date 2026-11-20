import { bookAction } from '@/server/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/actions/book: BookRequest -> ActionResult. A specialist request email with an .ics invite. */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const result = await bookAction(body ?? {});
  const status = result.ok ? 200 : result.error.kind === 'not_found' ? 404 : result.error.kind === 'invalid' ? 400 : 503;
  return Response.json(result, { status });
}
