/**
 * The client API layer. With NEXT_PUBLIC_MOCK=1 it replays the contract fixtures through mockStream;
 * otherwise it calls the real endpoints in plans/CONTRACT.md section 3. Screens never know which.
 */
import type {
  ActionResult, ApiError, BookRequest, CheckRequest, EmailSendRequest, Report, SlotOffer, StreamEvent,
} from '@contract/types';
import * as mock from './mock';

export const MOCK = process.env.NEXT_PUBLIC_MOCK === '1';

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export interface RunOptions { signal?: AbortSignal; failStep?: string }

/** POST /api/check as an async stream of events. A stream that ends without `done` is a failed run. */
export function runCheck(req: CheckRequest, opts: RunOptions = {}): AsyncGenerator<StreamEvent> {
  return MOCK ? mock.runCheck(req, opts) : realRunCheck(req, opts);
}

export function getReport(id: string): Promise<Result<Report>> {
  return MOCK ? mock.getReport(id) : getJson<Report>(`/api/check/${encodeURIComponent(id)}`);
}

export function sendEmail(req: EmailSendRequest): Promise<ActionResult> {
  return MOCK ? mock.sendEmail(req) : postAction('/api/actions/email', req);
}

export function getSlots(reportId: string, unknownId: string): Promise<Result<SlotOffer>> {
  if (MOCK) return mock.getSlots(reportId, unknownId);
  const q = new URLSearchParams({ report: reportId, unknown: unknownId });
  return getJson<SlotOffer>(`/api/slots?${q.toString()}`);
}

export function book(req: BookRequest): Promise<ActionResult> {
  return MOCK ? mock.book(req) : postAction('/api/actions/book', req);
}

export async function uploadPacket(file: File): Promise<Result<{ packetFileId: string }>> {
  if (MOCK) return { ok: true, value: { packetFileId: `mock-${file.name}` } };
  const body = new FormData();
  body.append('file', file);
  try {
    const res = await fetch('/api/packet', { method: 'POST', body });
    const json = await res.json();
    if (!res.ok || isApiError(json)) return { ok: false, error: asApiError(json) };
    return { ok: true, value: json };
  } catch {
    return { ok: false, error: offline() };
  }
}

export function newKey(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

/* ---------- real transport ---------- */

async function* realRunCheck(req: CheckRequest, opts: RunOptions): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch('/api/check', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(req), signal: opts.signal,
    });
  } catch {
    yield { type: 'error', error: offline() };
    return;
  }
  if (!res.ok || !res.body) {
    let err: ApiError = { kind: 'unavailable', retryable: true };
    try { err = asApiError(await res.json()); } catch { /* body was not JSON; keep the generic kind */ }
    yield { type: 'error', error: err };
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
        const data = chunk.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
        if (!data) continue;
        try { yield JSON.parse(data) as StreamEvent; } catch { /* a malformed line is skipped; the run fails if done never arrives */ }
      }
    }
  } catch {
    if (opts.signal?.aborted) return;
    yield { type: 'error', error: offline() };
  }
}

async function getJson<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    const json = await res.json().catch(() => null);
    if (!res.ok || json == null || isApiError(json)) return { ok: false, error: asApiError(json, res.status) };
    return { ok: true, value: json as T };
  } catch {
    return { ok: false, error: offline() };
  }
}

async function postAction(url: string, body: unknown): Promise<ActionResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (json && typeof json === 'object' && 'ok' in json) return json as ActionResult;
    return { ok: false, error: asApiError(json, res.status) };
  } catch {
    return { ok: false, error: offline() };
  }
}

function isApiError(x: unknown): x is ApiError {
  return !!x && typeof x === 'object' && 'kind' in x && 'retryable' in x && !('id' in x);
}

function asApiError(x: unknown, status?: number): ApiError {
  if (isApiError(x)) return x;
  if (x && typeof x === 'object' && 'error' in x && isApiError((x as { error: unknown }).error)) return (x as { error: ApiError }).error;
  if (status === 404) return { kind: 'not_found', retryable: false };
  if (status === 429) return { kind: 'rate', retryable: true };
  return { kind: 'unavailable', retryable: true };
}

function offline(): ApiError { return { kind: 'offline', retryable: true }; }
