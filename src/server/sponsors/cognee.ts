import type { Report } from '../../contract/types';
import { after } from 'next/server';
import { reportContext } from './senso';

/**
 * Sponsor: Cognee memory. When COGNEE_API_KEY and COGNEE_BASE_URL (the workspace's "API base URL" from the Cognee
 * Cloud API Keys page) are set, every finished report is added to a Cognee dataset and turned into a knowledge graph,
 * and askHomes() answers questions across every home checked (exposed as the ask_checked_homes MCP tool).
 * Public city records only, no personal names. Off and silent when unset; never blocks or fails a report.
 */

const base = () => (process.env.COGNEE_BASE_URL || '').replace(/\/+$/, '').replace(/\/api(\/v1)?$/, '');
const dataset = () => process.env.COGNEE_DATASET || 'house_checker';
export const cogneeEnabled = () => !!(process.env.COGNEE_API_KEY && process.env.COGNEE_BASE_URL);

function headers(): Record<string, string> {
  return {
    'X-Api-Key': process.env.COGNEE_API_KEY!,
    ...(process.env.COGNEE_TENANT_ID ? { 'X-Tenant-Id': process.env.COGNEE_TENANT_ID } : {}),
    'content-type': 'application/json',
  };
}

async function post(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(`${base()}/api/v1/${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  if (!res.ok) throw new Error(`cognee ${path} ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

export async function rememberReport(report: Report): Promise<void> {
  if (!cogneeEnabled()) return;
  try {
    const { text } = reportContext(report);
    await post('add_text', { textData: [text], datasetName: dataset() }, 15_000);
    await post('cognify', { datasets: [dataset()], run_in_background: true }, 15_000);
  } catch (e) {
    if (process.env.HC_DEBUG) console.warn('[cognee]', (e as Error).message);
  }
}

/** Plain text out of whatever shape recall returns (a string, a list of answers, or result objects). */
function answerText(v: unknown, depth = 0): string {
  if (v == null || depth > 4) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => answerText(x, depth + 1)).filter(Boolean).join('\n\n');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['answer', 'completion', 'search_result', 'result', 'results', 'text', 'content']) if (o[k] != null) return answerText(o[k], depth + 1);
  }
  return JSON.stringify(v).slice(0, 2000);
}

export async function askHomes(question: string): Promise<string> {
  const v = await post('recall', { query: question, datasets: [dataset()] }, 60_000);
  return answerText(v).trim();
}

export function cogneeAfterReport(report: Report): void {
  if (!cogneeEnabled()) return;
  const fn = () => rememberReport(report);
  try { after(fn); } catch { void fn(); }
}
