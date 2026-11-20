import type { ActionLogEntry, Report } from '../../contract/types';

/**
 * A13 sponsor: Senso.ai context layer. When SENSO_API_KEY is set, each finished report's cited sources, findings
 * and action log are pushed to Senso as trusted context for the buyer's agent. Off and silent when unset; never
 * blocks or fails a report. Base URL is overridable (SENSO_BASE_URL) since Senso documents two API hosts.
 */

const base = () => (process.env.SENSO_BASE_URL || 'https://apiv2.senso.ai/api/v1').replace(/\/$/, '');
export const sensoEnabled = () => !!process.env.SENSO_API_KEY;

export function reportContext(report: Report): { title: string; text: string } {
  const lines = [
    `House Checker report ${report.id} for ${report.address}, San Francisco (parcel ${report.parcelDisplay}). Checked ${report.checkedAt}.`,
    `Verdict: ${report.decision.title}. ${report.answer}`,
    `Inspection: ${report.decision.inspection}`,
    '',
    'Listing vs city records:',
    ...report.ledger.map((r) => `- ${r.title}: listing ${r.listing ?? 'silent'}, records ${r.records ?? 'none'} (${r.label}). ${r.why}`),
    '',
    'Open city cases:',
    ...(report.cases.length ? report.cases.map((c) => `- ${c.title} (${c.label}). ${c.text}`) : ['- none']),
    '',
    'Open questions:',
    ...report.unknowns.map((u) => `- ${u.title} Resolver: ${u.resolver}. ${u.why}`),
    '',
    'Actions taken:',
    ...(report.actions.length ? report.actions.map((a) => `- ${a.at} ${a.summary}`) : ['- none yet']),
    '',
    'Sources (cited as [n]):',
    ...report.sources.map((s, i) => `[${i + 1}] ${s.title}, ${s.publisher}${s.date ? `, ${s.date}` : ''}${s.url ? ` ${s.url}` : ''}`),
  ];
  return { title: `House Checker: ${report.address} (${report.id})`, text: lines.join('\n') };
}

export async function pushToSenso(report: Report): Promise<void> {
  if (!sensoEnabled()) return;
  try {
    const { title, text } = reportContext(report);
    const res = await fetch(`${base()}/org/kb/raw`, {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { 'X-API-Key': process.env.SENSO_API_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({ title, text }),
    });
    if (!res.ok && process.env.HC_DEBUG) console.warn('[senso]', res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    if (process.env.HC_DEBUG) console.warn('[senso]', (e as Error).message);
  }
}

/** Fire and forget: never awaited on the request path. */
export function sensoAfterReport(report: Report): void { if (sensoEnabled()) void pushToSenso(report); }
export function sensoAfterAction(report: Report | null, _entry: ActionLogEntry): void { if (report && sensoEnabled()) void pushToSenso(report); }
