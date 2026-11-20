import { parseAddressLoose, resolveAddress } from '@/server/address';

export const runtime = 'nodejs';

/** GET /api/aerial?address= -> a satellite image centred on the home (JPEG).
 *  Mapbox satellite when MAPBOX_TOKEN is set; otherwise Esri World Imagery (no key, attribution shown on the page). */
export async function GET(req: Request): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('address') ?? '';
  const parsed = parseAddressLoose(raw.slice(0, 200));
  if (!parsed) return new Response('bad address', { status: 400 });
  const a = await resolveAddress(parsed).catch(() => null);
  if (!a || a.lat == null || a.lon == null) return new Response('not found', { status: 404 });
  const { lat, lon } = a;
  const token = process.env.MAPBOX_TOKEN;
  let url: string;
  if (token) {
    url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lon},${lat},19,0/1200x560@2x?attribution=false&logo=false&access_token=${encodeURIComponent(token)}`;
  } else {
    // About 150 m by 70 m around the point, in Web Mercator so the picture keeps its shape.
    const R = 6378137;
    const x = (lon * Math.PI * R) / 180;
    const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const k = 1 / Math.cos((lat * Math.PI) / 180); // mercator stretch at this latitude
    const hw = 75 * k, hh = 35 * k;
    url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${x - hw},${y - hh},${x + hw},${y + hh}&bboxSR=3857&imageSR=3857&size=1200,560&format=jpg&f=image`;
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!r || !r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return new Response('imagery unavailable', { status: 502 });
  return new Response(await r.arrayBuffer(), {
    headers: { 'content-type': r.headers.get('content-type') ?? 'image/jpeg', 'cache-control': 'public, max-age=86400, s-maxage=604800', 'x-imagery': token ? 'mapbox' : 'esri' },
  });
}
