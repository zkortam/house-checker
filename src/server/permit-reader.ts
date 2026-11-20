import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { llmJson } from './llm';
import { dataDir } from './store';
import type { Row } from './sources';

/**
 * A5: Claude reads permit descriptions only (never complaint free text) and tags what each permit does.
 * Code still decides every label; these tags only fill system rows the regex misses. Cached per permit number.
 */

export interface PermitFacts {
  permit: string;
  addsBaths: number | null;
  unitChange: number | null;    // +1 adds a unit, -1 removes one
  legalizesUnit: boolean;
  garageConversion: boolean;
  citesNov: boolean;
  rewire: boolean;
  sewerLateral: boolean;
  foundation: boolean;
  reroof: boolean;
}

const SCHEMA = {
  type: 'object',
  properties: {
    permits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          permit: { type: 'string' }, addsBaths: { type: ['number', 'null'] }, unitChange: { type: ['number', 'null'] },
          legalizesUnit: { type: 'boolean' }, garageConversion: { type: 'boolean' }, citesNov: { type: 'boolean' }, rewire: { type: 'boolean' },
          sewerLateral: { type: 'boolean' }, foundation: { type: 'boolean' }, reroof: { type: 'boolean' },
        },
        required: ['permit', 'addsBaths', 'unitChange', 'legalizesUnit', 'garageConversion', 'citesNov', 'rewire', 'sewerLateral', 'foundation', 'reroof'],
      },
    },
  },
  required: ['permits'],
} as const;

const file = () => path.join(dataDir(), 'cache', 'permit-facts.json');
let memo: Record<string, PermitFacts> | null = null;
async function cache(): Promise<Record<string, PermitFacts>> {
  if (memo) return memo;
  try { memo = JSON.parse(await readFile(file(), 'utf8')); } catch { memo = {}; }
  return memo!;
}

export function regexFacts(p: Row): PermitFacts {
  const d = (p.description ?? '').toLowerCase();
  const baths = d.match(/(\d+)\s+(?:new\s+)?bath/);
  return {
    permit: p.permit_number ?? '',
    addsBaths: /\badd(ing|ed)?\b[^.]*bath/.test(d) ? (baths ? Number(baths[1]) : 1) : null,
    unitChange: p.existing_units && p.proposed_units ? Number(p.proposed_units) - Number(p.existing_units) || null : null,
    legalizesUnit: /legaliz/.test(d) && /(unit|adu|dwelling)/.test(d),
    garageConversion: /garage/.test(d) && /(convert|habitable|bedroom|unit)/.test(d),
    citesNov: /\bnov\b|notice of violation/.test(d),
    rewire: /rewir|knob|panel|service upgrade|200 ?a/.test(d),
    sewerLateral: /sewer lateral|side sewer|lateral/.test(d),
    foundation: /foundation|seismic|retrofit|grade beam|underpin/.test(d),
    reroof: /re-?roof|roofing/.test(d),
  };
}

/**
 * Tags every permit. The model reads only the newest uncached permits (at most 20, batches in parallel) within a
 * time budget, so a 400-unit building never waits on it; everything else gets the regex tags.
 */
export async function readPermits(permits: Row[], onProgress?: (done: number, total: number) => void, budgetMs = Number(process.env.HC_PERMIT_READER_MS ?? 10_000)): Promise<Map<string, PermitFacts>> {
  const out = new Map<string, PermitFacts>();
  const known = await cache();
  for (const p of permits) if (p.permit_number && known[p.permit_number]) out.set(p.permit_number, known[p.permit_number]);
  const todo = permits.filter((p) => p.permit_number && p.description && !known[p.permit_number])
    .sort((a, b) => (b.filed_date ?? '').localeCompare(a.filed_date ?? '')).slice(0, 20);
  onProgress?.(out.size, permits.length);
  const batches: Row[][] = [];
  for (let i = 0; i < todo.length; i += 10) batches.push(todo.slice(i, i + 10));
  const work = Promise.all(batches.map(async (batch) => {
    const { value, source } = await llmJson<{ permits: PermitFacts[] }>(SCHEMA,
      `Tag each San Francisco building permit by its description only. addsBaths: number of bathrooms added (not remodeled in kind), else null. unitChange: +n units added or -n removed, else null.\n\n${batch.map((p) => `${p.permit_number}: ${(p.description ?? '').slice(0, 400)}`).join('\n')}`,
      () => ({ permits: batch.map(regexFacts) }),
      { timeoutMs: budgetMs, retries: 0, validate: (v) => Array.isArray(v.permits) && v.permits.every((f) => batch.some((b) => b.permit_number === f.permit)) });
    for (const f of value.permits) { out.set(f.permit, f); if (source === 'model') known[f.permit] = f; }
    onProgress?.(Math.min(out.size, permits.length), permits.length);
  }));
  await Promise.race([work, new Promise((r) => setTimeout(r, budgetMs + 500))]);
  for (const p of permits) if (p.permit_number && !out.has(p.permit_number)) out.set(p.permit_number, regexFacts(p));
  try { await mkdir(path.dirname(file()), { recursive: true }); await writeFile(file(), JSON.stringify(known)); } catch { /* best effort */ }
  return out;
}
