import { storePacket } from '@/server/packet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/packet (multipart, field "file", PDF) -> { packetFileId } or ApiError. */
export async function POST(req: Request): Promise<Response> {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file') ?? form.get('packet');
    if (f && typeof f !== 'string') file = f;
  } catch { /* not multipart */ }
  if (!file) return Response.json({ kind: 'invalid', retryable: false }, { status: 400 });
  const out = await storePacket(new Uint8Array(await file.arrayBuffer()), file.name);
  if ('error' in out) return Response.json({ kind: out.error, retryable: out.error === 'unavailable', debug: out.debug }, { status: out.error === 'invalid' ? 400 : 503 });
  return Response.json(out);
}
