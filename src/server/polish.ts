import type { Report } from '../contract/types';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { llmEnabled, llmJson } from './llm';
import { rejectReason } from './writer';
import { dataDir } from './store';

/**
 * Plain-words pass: Claude (local CLI) rewrites every finding's title and text so a first-time buyer understands it
 * on first read. The rule text is the evidence: each rewrite must keep the same facts, use no number that is not in
 * its original, keep only the original's [n] citations (at least one when the original had any), and pass the copy
 * rules. A rewrite that fails any check is dropped and the rule text stays.
 */

type Item = { id: string; text: string; max: number; title?: boolean };

const CITE = /\[(\d+)\]/g;
const citesOf = (s: string) => new Set([...s.matchAll(CITE)].map((m) => m[1]));

function itemsOf(r: Report): Item[] {
  const xs: Item[] = [];
  const add = (id: string, text: string | null | undefined, max: number, title = false) => { if (text && text.trim()) xs.push({ id, text, max, title }); };
  r.cases.forEach((c, i) => { add(`cases.${i}.title`, c.title, 70, true); add(`cases.${i}.text`, c.text, 320); add(`cases.${i}.stake`, c.stake, 160); });
  r.tenants.forEach((x, i) => { add(`tenants.${i}.title`, x.title, 60, true); add(`tenants.${i}.text`, x.text, 320); });
  r.upside.forEach((x, i) => { add(`upside.${i}.title`, x.title, 60, true); add(`upside.${i}.text`, x.text, 300); });
  r.nearby.forEach((x, i) => { add(`nearby.${i}.text`, x.text, 300); });
  r.hazards.forEach((x, i) => { if (x.status === 'note') add(`hazards.${i}.text`, x.text, 260); });
  r.systems.forEach((x, i) => { add(`systems.${i}.text`, x.text, 260); });
  r.ledger.forEach((x, i) => { add(`ledger.${i}.why`, x.why, 320); });
  r.unknowns.forEach((x, i) => { add(`unknowns.${i}.title`, x.title, 110, true); add(`unknowns.${i}.why`, x.why, 260); });
  r.highlights.good.forEach((t, i) => add(`good.${i}`, t, 90));
  r.highlights.watch.forEach((t, i) => add(`watch.${i}`, t, 90));
  return xs;
}

function check(item: Item, out: string, sources: number): string | null {
  const why = rejectReason(out, item.text, sources, item.max);
  if (why) return why;
  const before = citesOf(item.text), after = citesOf(out);
  for (const n of after) if (!before.has(n)) return `new citation [${n}]`;
  if (before.size && !after.size) return 'dropped citations';
  // Record ids (permit, case and buyout numbers) are how the buyer asks about it: keep every one.
  for (const id of item.text.replace(CITE, '').match(/\b[A-Z]?\d{6,}[A-Z]*\b|\b\d{4}-\d{6}[A-Z]+\b/g) ?? []) if (!out.includes(id)) return `dropped record id ${id}`;
  return null;
}

const SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'] } } },
  required: ['items'],
} as const;

const SYSTEM = [
  'You rewrite lines of a San Francisco home-buying report so a first-time buyer with no real-estate knowledge understands each one on first read.',
  'Lead with what it means for the buyer, then what to do. Short sentences, everyday words. Explain or drop jargon (say "the city building department", not "DBI"; "made legal", not "certified"; "never closed", not "stale").',
  'Keep every fact, every number exactly as written, every record number (permit, case, buyout ids) and every [n] citation that supports a fact. Never add a fact, number or citation.',
  'Titles stay short labels without citations. Keep each item about as long as the original or shorter.',
  'No markdown, no exclamation marks, no em dashes, never "we", "our", "us", "please", "just" or "simply". Never call anything illegal or say the listing lies.',
].join(' ');

export type Polish = Map<string, string>;

export async function polishText(report: Report): Promise<Polish> {
  const out: Polish = new Map();
  if (!llmEnabled()) return out;
  const items = itemsOf(report);
  if (!items.length) return out;
  const prompt = `${SYSTEM}\n\nRewrite each item. Return every id once.\n\n${JSON.stringify(items.map(({ id, text, title }) => ({ id, text, kind: title ? 'title' : 'text' })))}`;
  const sources = report.sources.length;
  const cacheFile = path.join(dataDir(), 'cache', 'polish', createHash('sha1').update(prompt).digest('hex').slice(0, 24) + '.json');
  let got: Array<{ id: string; text: string }> | null = null;
  try { got = (JSON.parse(await readFile(cacheFile, 'utf8')) as { items: Array<{ id: string; text: string }> }).items; } catch { /* miss */ }
  if (!got) {
    const { value, source } = await llmJson<{ items: Array<{ id: string; text: string }> }>(SCHEMA, prompt, () => ({ items: [] }),
      { timeoutMs: Number(process.env.HC_POLISH_MS ?? 60_000), retries: 0, maxWaitMs: 20_000, validate: (v) => Array.isArray(v?.items) });
    if (source === 'fallback') return out;
    got = value.items;
    try { await mkdir(path.dirname(cacheFile), { recursive: true }); await writeFile(cacheFile, JSON.stringify({ items: got })); } catch { /* best effort */ }
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const g of got) {
    const item = byId.get(g?.id);
    const text = typeof g?.text === 'string' ? g.text.trim() : '';
    if (!item || !text || text === item.text) continue;
    const why = check(item, text, sources);
    if (why) { if (process.env.HC_DEBUG) console.warn('[polish] kept rule text:', item.id, why, '|', text); continue; }
    out.set(item.id, text);
  }
  return out;
}

/** Apply checked rewrites by id; untouched fields keep the rule text. */
export function applyPolish(r: Report, p: Polish): Report {
  if (!p.size) return r;
  const get = (id: string, cur: string) => p.get(id) ?? cur;
  return {
    ...r,
    cases: r.cases.map((c, i) => ({ ...c, title: get(`cases.${i}.title`, c.title), text: get(`cases.${i}.text`, c.text), ...(c.stake ? { stake: get(`cases.${i}.stake`, c.stake) } : {}) })),
    tenants: r.tenants.map((x, i) => ({ ...x, title: get(`tenants.${i}.title`, x.title), text: get(`tenants.${i}.text`, x.text) })),
    upside: r.upside.map((x, i) => ({ ...x, title: get(`upside.${i}.title`, x.title), text: get(`upside.${i}.text`, x.text) })),
    nearby: r.nearby.map((x, i) => ({ ...x, text: get(`nearby.${i}.text`, x.text) })),
    hazards: r.hazards.map((x, i) => ({ ...x, text: get(`hazards.${i}.text`, x.text) })),
    systems: r.systems.map((x, i) => ({ ...x, text: get(`systems.${i}.text`, x.text) })),
    ledger: r.ledger.map((x, i) => ({ ...x, why: get(`ledger.${i}.why`, x.why) })),
    unknowns: r.unknowns.map((x, i) => ({ ...x, title: get(`unknowns.${i}.title`, x.title), why: get(`unknowns.${i}.why`, x.why) })),
    highlights: { good: r.highlights.good.map((t, i) => get(`good.${i}`, t)), watch: r.highlights.watch.map((t, i) => get(`watch.${i}`, t)) },
  };
}
