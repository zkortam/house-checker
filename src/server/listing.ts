import type { ListingClaims } from '../contract/types';
import { parseAddress, parseAddressLoose } from './address';
import { llmJson } from './llm';

/**
 * A1: pasted listing text -> ListingClaims. A regex reader always runs (fast, offline); the Claude CLI fills
 * gaps when the text is free-form. Numbers the model returns must appear in the text, or they are dropped.
 */

const OTHER_CITIES = /\b(berkeley|oakland|daly city|south san francisco|san mateo|palo alto|alameda|emeryville|richmond|sausalito|san jose|pacifica|brisbane|millbrae|burlingame|san bruno|marin|mill valley|los angeles|san diego|sacramento|fremont|hayward|walnut creek|redwood city|menlo park|mountain view|sunnyvale|santa clara|colma)\b,?\s*(?:ca|california)?\b/i;
const SF = /\b(san francisco|\bsf\b)/i;

export type ListingResult = { ok: true; claims: ListingClaims; agentEmail: string | null } | { ok: false; kind: 'invalid' | 'outside_sf' };

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[,$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, single: 1, duplex: 2, triplex: 3, fourplex: 4 };
const wordNum = (s: string) => (/^\d/.test(s) ? Number(s) : WORDS[s.toLowerCase()] ?? null);

export function readListingRegex(text: string): ListingClaims {
  const t = text.replace(/ /g, ' ');
  const addr = parseAddress(t);
  let price: number | null = null;
  const pm = t.match(/(?:offered at|list(?:ed)? (?:price|at)|asking|price[d]?(?: at)?:?)\s*\$\s?([\d,.]+)\s*(m|million|k)?/i) ?? t.match(/\$\s?([\d,.]+)\s*(m|million|k)?\b/i)
    ?? t.match(/(?:offered at|asking|list price|priced at)\s*([\d,.]+)\s*(m|million|k)\b/i); // "asking 799k", no dollar sign
  if (pm) {
    const base = num(pm[1]);
    const mult = pm[2] ? (/^m/i.test(pm[2]) ? 1_000_000 : 1_000) : 1;
    price = base != null ? Math.round(base * mult) : null;
    if (price != null && price < 10_000) price = null;
  }
  const beds = t.match(/(\d+(?:\.\d+)?)\s*(?:bed(?:room)?s?|br|bd)\b/i);
  const baths = t.match(/(\d+(?:\.\d+)?)\s*(?:bath(?:room)?s?|ba)\b/i);
  const sqft = t.match(/([\d,]{3,7})\s*(?:\+\s*)?(?:sq\.?\s*ft|square feet|sf\b|sqft)/i);
  const units = t.match(/\b(\d+|two|three|four|five|six)[- ]units?\b/i) ?? t.match(/\b(duplex|triplex|fourplex)\b/i);
  let adu: ListingClaims['adu'] = null;
  if (/\b(legal|permitted|legalized|warranted)\s+(in-?law|adu|accessory dwelling|second unit|junior adu|jadu)/i.test(t)) adu = 'legal';
  else if (/\b(in-?law|adu|accessory dwelling|au pair|guest (suite|unit)|granny|second unit|junior adu|jadu)\b/i.test(t)) adu = 'claimed';
  const renovations: string[] = [];
  for (const [re, label] of [
    [/\b(fully |completely |newly |recently )?(remodel(?:ed)?|renovat(?:ed|ion))\b/i, 'remodeled'],
    [/\bnew roof\b/i, 'new roof'], [/\b(new|updated) (kitchen)\b/i, 'new kitchen'], [/\b(new|updated|remodeled) bath(room)?s?\b/i, 'new baths'],
    [/\b(seismic(ally)? (retrofit|upgrade)|foundation)\b/i, 'seismic work'], [/\b(new|updated) (electrical|wiring|panel)\b/i, 'new electrical'],
    [/\b(new|updated) plumbing\b/i, 'new plumbing'], [/\bsewer lateral\b/i, 'sewer lateral'], [/\b(new|added) (bath|bedroom|level|story)\b/i, 'addition'],
  ] as Array<[RegExp, string]>) if (re.test(t) && !renovations.includes(label)) renovations.push(label);
  return {
    address: addr?.display ?? null,
    price,
    units: units ? wordNum(units[1]) : (/\bsingle[- ]family\b/i.test(t) ? 1 : null),
    beds: beds ? Number(beds[1]) : null,
    baths: baths ? Number(baths[1]) : null,
    sqft: sqft ? num(sqft[1]) : null,
    adu,
    renovations,
  };
}

const SCHEMA = {
  type: 'object',
  properties: {
    address: { type: ['string', 'null'], description: 'Street address only, e.g. "2055 42nd Ave"' },
    city: { type: ['string', 'null'] },
    price: { type: ['number', 'null'] }, units: { type: ['number', 'null'] }, beds: { type: ['number', 'null'] },
    baths: { type: ['number', 'null'] }, sqft: { type: ['number', 'null'] },
    adu: { type: ['string', 'null'], enum: ['legal', 'claimed', null] },
    renovations: { type: 'array', items: { type: 'string' } },
  },
  required: ['address', 'city', 'price', 'units', 'beds', 'baths', 'sqft', 'adu', 'renovations'],
} as const;

export async function readListing(text: string): Promise<ListingResult> {
  const clean = (text ?? '').trim();
  if (clean.length < 8) return { ok: false, kind: 'invalid' };
  if (OTHER_CITIES.test(clean) && !SF.test(clean.replace(/south san francisco/ig, ''))) return { ok: false, kind: 'outside_sf' };
  const regex = readListingRegex(clean);
  const agentEmail = clean.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const missing = !regex.address || regex.price == null || (regex.beds == null && regex.baths == null);
  if (!missing) return { ok: true, claims: regex, agentEmail };
  const digits = clean.replace(/[,\s]/g, '');
  // A number the model returns must be written in the text, as digits or in words ("two bedrooms", "1.35 million").
  const worded = /\b(one|two|three|four|five|six|seven|eight|nine|ten|half|hundred|thousand|million|m)\b/i.test(clean);
  const appears = (n: number | null) => n == null || digits.includes(String(n)) || clean.includes(String(n)) || worded;
  const { value } = await llmJson<ListingClaims & { city: string | null }>(SCHEMA,
    `Read this real estate listing and return only what it states. Use null for anything not stated. Do not infer.\n\nListing:\n${clean.slice(0, 6000)}`,
    () => ({ ...regex, city: null }),
    { timeoutMs: 45_000, validate: (v) => appears(v.beds) && appears(v.baths) && appears(v.units) },
  );
  if (value.city && !/san francisco|^sf$/i.test(value.city)) return { ok: false, kind: 'outside_sf' };
  const merged: ListingClaims = {
    address: regex.address ?? (value.address ? parseAddressLoose(value.address)?.display ?? null : null),
    price: regex.price ?? (appears(value.price) ? value.price : null),
    units: regex.units ?? (appears(value.units) ? value.units : null),
    beds: regex.beds ?? value.beds,
    baths: regex.baths ?? value.baths,
    sqft: regex.sqft ?? (appears(value.sqft) ? value.sqft : null),
    adu: regex.adu ?? value.adu ?? null,
    renovations: regex.renovations.length ? regex.renovations : (value.renovations ?? []).slice(0, 6),
  };
  if (!merged.address) return { ok: false, kind: 'invalid' };
  return { ok: true, claims: merged, agentEmail };
}
