/**
 * Small in-memory limit on real outgoing email (Resend), so the public site can't be used to send bulk mail from the
 * sending domain. Per visitor (IP) and per server instance. Demo-outbox sends are never limited.
 */
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Returns seconds to wait when over the limit, else null and records the hit. */
export function overLimit(key: string, max = Number(process.env.HC_EMAIL_PER_HOUR ?? 6), windowMs = 3_600_000): number | null {
  const now = Date.now();
  const xs = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const all = [...hits.values()].flat().filter((t) => now - t < 86_400_000).length;
  if (xs.length >= max || all >= Number(process.env.HC_EMAIL_PER_DAY ?? 200)) {
    hits.set(key, xs);
    return Math.max(60, Math.ceil((windowMs - (now - (xs[0] ?? now))) / 1000));
  }
  xs.push(now);
  hits.set(key, xs);
  return null;
}
