import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './store';

/**
 * One HTTP layer for every city source: timeout, one jittered retry, a 24 h file cache under .data/cache,
 * recording (HC_RECORD_DIR) and offline replay (HC_REPLAY_DIR) so tests never touch the network.
 */

export class FetchError extends Error {
  kind: 'timeout' | 'unavailable' | 'offline';
  url: string;
  constructor(message: string, kind: 'timeout' | 'unavailable' | 'offline', url: string) { super(message); this.kind = kind; this.url = url; }
}

const DAY = 24 * 60 * 60 * 1000;

function cacheDir(): string { return process.env.HC_CACHE_DIR ?? path.join(dataDir(), 'cache'); }
function key(url: string): string { return createHash('sha1').update(url).digest('hex').slice(0, 20); }

async function readJsonFile(file: string): Promise<unknown | undefined> {
  try { const raw = JSON.parse(await readFile(file, 'utf8')); return raw.body; } catch { return undefined; }
}

async function writeJsonFile(dir: string, url: string, body: unknown): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key(url) + '.json'), JSON.stringify({ url, at: new Date().toISOString(), body }));
  } catch { /* cache is best effort */ }
}

export interface GetOpts { timeoutMs?: number; ttlMs?: number; label?: string }

/** Failure injection for tests and demos: HC_FAIL=permits,hazards makes those labels time out. */
function forcedFail(label?: string): boolean {
  const list = (process.env.HC_FAIL ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return !!label && list.includes(label);
}

export async function getJson<T = unknown>(url: string, opts: GetOpts = {}): Promise<T> {
  if (forcedFail(opts.label)) throw new FetchError(`forced failure for ${opts.label}`, 'timeout', url);
  const replay = process.env.HC_REPLAY_DIR;
  if (replay) {
    const body = await readJsonFile(path.join(replay, key(url) + '.json'));
    if (body === undefined) throw new FetchError(`no recording for ${url}`, 'offline', url);
    return body as T;
  }
  // Demo mode: recorded responses first (fast, works offline), the network for anything not recorded.
  if (process.env.HC_DEMO_RECORDINGS === '1') {
    const dir = path.join(process.cwd(), 'tests', 'server', 'recordings');
    const body = await readJsonFile(path.join(dir, key(url) + '.json'));
    if (body !== undefined) return body as T;
  }
  const ttl = opts.ttlMs ?? DAY;
  const file = path.join(cacheDir(), key(url) + '.json');
  if (existsSync(file)) {
    try {
      const s = await stat(file);
      if (Date.now() - s.mtimeMs < ttl) {
        const body = await readJsonFile(file);
        if (body !== undefined) { await record(url, body); return body as T; }
      }
    } catch { /* fall through to network */ }
  }
  const timeoutMs = opts.timeoutMs ?? Number(process.env.HC_FETCH_TIMEOUT_MS ?? 10_000);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
    try {
      // An optional Socrata app token lifts DataSF's anonymous throttling; never logged or recorded.
      const token: Record<string, string> = process.env.DATASF_APP_TOKEN && /data\.sf\.gov/.test(url) ? { 'X-App-Token': process.env.DATASF_APP_TOKEN } : {};
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json', ...token } });
      if (!res.ok) { lastErr = new FetchError(`HTTP ${res.status}`, 'unavailable', url); if (res.status < 500 && res.status !== 429) break; continue; }
      const body = await res.json();
      // Caching and recording are best effort: a read-only disk must never turn a good response into a failure.
      await writeJsonFile(cacheDir(), url, body).catch(() => undefined);
      await Promise.resolve(record(url, body)).catch(() => undefined);
      return body as T;
    } catch (e) {
      lastErr = e instanceof FetchError ? e : new FetchError(String((e as Error)?.message ?? e), (e as Error)?.name === 'TimeoutError' ? 'timeout' : 'unavailable', url);
    }
  }
  // Stale cache beats a failure.
  const stale = existsSync(file) ? await readJsonFile(file) : undefined;
  if (stale !== undefined) return stale as T;
  throw lastErr;
}

async function record(url: string, body: unknown): Promise<void> {
  const dir = process.env.HC_RECORD_DIR;
  if (dir) await writeJsonFile(dir, url, body);
}

export const DATASF = 'https://data.sf.gov/resource/';

/** SoQL query URL. Values in `where` must already be escaped with q(). */
export function soqlUrl(dataset: string, params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k.startsWith('$') ? k : '$' + k, String(v));
  return `${DATASF}${dataset}.json?${sp.toString()}`;
}

export function soql<T = Record<string, string>>(dataset: string, params: Record<string, string | number | undefined>, opts: GetOpts = {}): Promise<T[]> {
  return getJson<T[]>(soqlUrl(dataset, params), opts).then((r) => (Array.isArray(r) ? r : []));
}

/** Escape a SoQL string literal. */
export function q(s: string): string { return `'${s.replace(/'/g, "''")}'`; }
export function inList(values: string[]): string { return `(${values.map(q).join(',')})`; }

/** Public record link for a DataSF query (opens the JSON rows for that record). */
export function recordUrl(dataset: string, field: string, value: string): string {
  return `${DATASF}${dataset}.json?${field}=${encodeURIComponent(value)}`;
}
