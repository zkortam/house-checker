import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './store';

/**
 * Email through Resend's REST API when RESEND_API_KEY and RESEND_FROM are set; otherwise the message is written
 * to .data/outbox/*.json and reported as "Saved to outbox (demo)". Keys never leave the server.
 */

export interface OutgoingEmail {
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>; // content is plain text (e.g. .ics)
  idempotencyKey?: string;
}

export type SendResult = { ok: true; mode: 'resend' | 'outbox'; id: string } | { ok: false; reason: string; retryable: boolean };

export const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

export function emailMode(): 'resend' | 'outbox' {
  return process.env.RESEND_API_KEY && process.env.RESEND_FROM ? 'resend' : 'outbox';
}

/** Placeholder domains (RFC 2606) never receive mail; sending there through Resend only bounces. */
const RESERVED = /@(?:[^@]+\.)?(?:example\.(?:com|org|net)|[^@]+\.(?:test|invalid|example|localhost))$/i;

async function toOutbox(msg: OutgoingEmail, note?: string): Promise<SendResult> {
  const id = `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.join(dataDir(), 'outbox');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.json`), JSON.stringify({ id, at: new Date().toISOString(), ...(note ? { note } : {}), ...msg }, null, 1));
  return { ok: true, mode: 'outbox', id };
}

export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  if (emailMode() === 'outbox') return toOutbox(msg);
  if (msg.to.every((t) => RESERVED.test(t))) return toOutbox(msg, 'placeholder recipient, not sent');
  try {
    const res = await fetch(`${process.env.RESEND_BASE_URL || 'https://api.resend.com'}/emails`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
        ...(msg.idempotencyKey ? { 'idempotency-key': msg.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: msg.to,
        ...(msg.cc?.length ? { cc: msg.cc } : {}),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        subject: msg.subject,
        text: msg.text,
        ...(msg.attachments?.length ? {
          attachments: msg.attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64'), content_type: a.contentType })),
        } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    // Resend refuses recipients it may not mail (a test sender can only reach the account owner, an unverified
    // domain): keep the message in the outbox so the action still completes, labelled as demo.
    if (res.status === 403 || res.status === 422) return toOutbox(msg, `Resend ${res.status}: ${body.message ?? ''}`.slice(0, 300));
    if (!res.ok) return { ok: false, reason: `Resend ${res.status}: ${body.message ?? ''}`, retryable: res.status >= 500 || res.status === 429 };
    return { ok: true, mode: 'resend', id: body.id ?? 'sent' };
  } catch (e) {
    return { ok: false, reason: String((e as Error).message), retryable: true };
  }
}
