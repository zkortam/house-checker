import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ActionLogEntry, Report } from '../contract/types';

/** Reports and small state as JSON files under .data/ (gitignored). */
export function dataDir(): string { return process.env.HC_DATA_DIR ?? path.join(process.cwd(), '.data'); }

const safe = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, '_');

async function writeAtomic(file: string, body: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, body);
  await rename(tmp, file);
}

export async function readJson<T>(file: string): Promise<T | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as T; } catch { return null; }
}

export async function saveReport(report: Report): Promise<void> {
  await writeAtomic(path.join(dataDir(), 'reports', safe(report.id) + '.json'), JSON.stringify(report, null, 1));
}

export async function getReport(id: string): Promise<Report | null> {
  return readJson<Report>(path.join(dataDir(), 'reports', safe(id) + '.json'));
}

export async function listReports(): Promise<string[]> {
  try { return (await readdir(path.join(dataDir(), 'reports'))).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)); } catch { return []; }
}

// Serialize writes per report so two actions never overwrite each other's log entry.
// One map per server process, not per route bundle: email and book run in different bundles in production.
const locks: Map<string, Promise<unknown>> = ((globalThis as unknown as { __hcLocks?: Map<string, Promise<unknown>> }).__hcLocks ??= new Map());
export async function appendAction(reportId: string, entry: ActionLogEntry): Promise<Report | null> {
  const prev = locks.get(reportId) ?? Promise.resolve();
  const next = prev.then(async () => {
    const r = await getReport(reportId);
    if (!r) return null;
    r.actions = [...(r.actions ?? []).filter((a) => a.id !== entry.id), entry];
    await saveReport(r);
    return r;
  });
  locks.set(reportId, next.catch(() => undefined));
  return next;
}

/** Idempotency: the first result for a key is stored and returned for every repeat. */
export async function idempotent<T>(scope: string, key: string, run: () => Promise<T>): Promise<T> {
  const file = path.join(dataDir(), 'idempotency', safe(scope) + '__' + safe(key) + '.json');
  const prior = await readJson<{ result: T }>(file);
  if (prior) return prior.result;
  const inflight = locks.get(file);
  if (inflight) return inflight as Promise<T>;
  const p = (async () => {
    const result = await run();
    await writeAtomic(file, JSON.stringify({ at: new Date().toISOString(), result }));
    return result;
  })();
  locks.set(file, p);
  try { return await p; } finally { locks.delete(file); }
}

/* In-flight runs, shared across route bundles in one server process, so a refresh mid-stream gets the report. */
type Inflight = Map<string, Promise<Report | null>>;
const g = globalThis as unknown as { __hcInflight?: Inflight };
const inflight: Inflight = (g.__hcInflight ??= new Map());

export function trackRun(id: string, p: Promise<Report | null>): void {
  inflight.set(id, p);
  p.finally(() => { if (inflight.get(id) === p) inflight.delete(id); }).catch(() => undefined);
}

/** The stored report, or, when the run is still going, the report once it finishes (up to waitMs). */
export async function getReportOrWait(id: string, waitMs = 90_000): Promise<Report | null> {
  const stored = await getReport(id);
  if (stored) return stored;
  const run = inflight.get(id);
  if (!run) return null;
  const done = await Promise.race([run.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), waitMs))]);
  return done ?? (await getReport(id));
}
