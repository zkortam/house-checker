import type { Report } from '../contract/types';
import { checkCitations, checkCopy } from '../contract/copy';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { llmEnabled, llmJson } from './llm';
import { dataDir } from './store';

/**
 * A9: Claude (through the local CLI) rewrites the short answer and the inspection line in plain words, citing
 * only [n] from the report's sources. Every candidate must pass checkCopy and checkCitations, stay within
 * length, and use no number that is not already in the evidence. Otherwise the rule's own sentence stays.
 */

const NUM = /\d[\d,.]*/g;

function numbersIn(s: string): Set<string> {
  return new Set((s.match(NUM) ?? []).map((x) => x.replace(/[,.]$/, '').replace(/,/g, '')));
}

export function acceptable(text: string, evidence: string, sourceCount: number, maxLength: number): boolean {
  if (!text || typeof text !== 'string') return false;
  if (checkCopy(text, { maxLength }).length) return false;
  if (checkCitations(text, sourceCount).length) return false;
  const allowed = numbersIn(evidence);
  for (const m of text.replace(/\[\d+\]/g, '').match(NUM) ?? []) {
    const v = m.replace(/[,.]$/, '').replace(/,/g, '');
    if (!allowed.has(v)) return false;
  }
  return true;
}

const SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'One or two short sentences, at most 200 characters, with [n] citations' },
    inspection: { type: 'string', description: 'One sentence on what inspection is needed' },
  },
  required: ['answer', 'inspection'],
} as const;

const SYSTEM = [
  'You write the top of a home-buying report for a first-time buyer in San Francisco.',
  'Plain words, no jargon, no markdown, no exclamation marks, no em dashes, never "we", "our", "us", "please", "just" or "simply".',
  'Never call a listing illegal or misrepresented. Say what the records show.',
  'Use only facts and numbers from the evidence. Cite with [n] exactly as the evidence does. Never invent a citation.',
].join(' ');

export async function writeProse(report: Report): Promise<Report> {
  const evidence = [
    `Address: ${report.address}`,
    `Verdict: ${report.decision.title}`,
    `Rule answer: ${report.answer}`,
    `Rule inspection line: ${report.decision.inspection}`,
    ...report.ledger.map((r) => `Claim ${r.title}: listing ${r.listing ?? 'silent'}, records ${r.records ?? 'none'}. ${r.why}`),
    ...report.cases.map((c) => `Case: ${c.title}. ${c.text}`),
    ...report.highlights.watch.map((w) => `Watch: ${w}`),
  ].join('\n');
  const prompt = `${SYSTEM}\n\nEvidence:\n${evidence}\n\nWrite "answer" (at most 200 characters, the most important finding first, with citations) and "inspection" (one sentence, no citations needed).`;
  const sources = report.sources.length;
  // Same evidence, same sentences: a repeat check (demo, refresh) reuses the checked model output.
  const cacheFile = path.join(dataDir(), 'cache', 'writer', createHash('sha1').update(prompt).digest('hex').slice(0, 24) + '.json');
  if (llmEnabled()) {
    try {
      const hit = JSON.parse(await readFile(cacheFile, 'utf8')) as { answer: string; inspection: string };
      if (acceptable(hit.answer, evidence, sources, 220) && acceptable(hit.inspection, evidence, sources, 240)) {
        return { ...report, answer: hit.answer, decision: { ...report.decision, inspection: hit.inspection } };
      }
    } catch { /* miss */ }
  }
  const { value, source } = await llmJson<{ answer: string; inspection: string }>(SCHEMA, prompt,
    () => ({ answer: report.answer, inspection: report.decision.inspection }),
    { timeoutMs: Number(process.env.HC_WRITER_MS ?? 15_000), retries: 0, validate: (v) => acceptable(v.answer, evidence, sources, 220) && acceptable(v.inspection, evidence, sources, 240) });
  if (source === 'fallback') return report;
  try { await mkdir(path.dirname(cacheFile), { recursive: true }); await writeFile(cacheFile, JSON.stringify({ answer: value.answer.trim(), inspection: value.inspection.trim() })); } catch { /* best effort */ }
  return { ...report, answer: value.answer.trim(), decision: { ...report.decision, inspection: value.inspection.trim() } };
}
