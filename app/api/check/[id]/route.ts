import { getReportOrWait } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/check/[id]: the stored Report, or ApiError not_found. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const report = await getReportOrWait(id);
  if (!report) return Response.json({ kind: 'not_found', retryable: false }, { status: 404 });
  return Response.json(report, { headers: { 'cache-control': 'no-store' } });
}
