import { slotsFor } from '@/server/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/slots?report=&unknown= -> SlotOffer (next weekdays, 9 AM and 1 PM Pacific). */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const offer = await slotsFor(url.searchParams.get('report'), url.searchParams.get('unknown'));
  if ('kind' in offer) return Response.json(offer, { status: offer.kind === 'not_found' ? 404 : 400 });
  return Response.json(offer);
}
