import type { ListingClaims } from '../contract/types';
import { parseAddress, parseAddressLoose } from './address';
import { llmJson } from './llm';

/**
 * A1: pasted listing text -> ListingClaims. A regex reader always runs (fast, offline); the Claude CLI fills
 * gaps when the text is free-form. Numbers the model returns must appear in the text, or they are dropped.
 */

const OTHER_CITIES = /\b(berkeley|oakland|daly city|south san francisco|san mateo|palo alto|alameda|emeryville|richmond|sausalito|san jose|pacifica|brisbane|millbrae|burlingame|san bruno|marin|mill valley|los angeles|san diego|sacramento|fremont|hayward|walnut creek|redwood city|menlo park|mountain view|sunnyvale|santa clara|colma)\b,?\s*(?:ca|california)?\b/i;
const SF = /\b(san francisco|\bsf\b)/i;
const CITY_NAMES = new RegExp(OTHER_CITIES.source.slice(0, OTHER_CITIES.source.indexOf(')\\b') + 3), 'gi'); // names only, no ", CA" tail

/** Another city named in city position ("…, Oakland", "in Berkeley", "Oakland CA 94607"), not a street or district
 *  that shares its name (Sacramento St, Fremont St, San Jose Ave, Inner Richmond). */
export function namesOtherCity(text: string): boolean {
  for (const m of text.matchAll(CITY_NAMES)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 12), at);
    const after = text.slice(at + m[0].length, at + m[0].length + 16);
    if (/^\s+(st|street|ave|avenue|blvd|boulevard|way|ter|terrace|pl|place|dr|drive|ct|court|ln|lane|rd|road|aly|alley|cir|plz|hwy)\b/i.test(after)) continue;
    if (/(inner|outer|central)\s+$/i.test(before)) continue;
    if (/,\s*$|\bin\s+$/i.test(before) || /^\s*,?\s*(ca|california)\b|^\s*,?\s*9[0-5]\d{3}\b/i.test(after)) return true;
  }
  return false;
}

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
  const toPrice = (n: string, unit?: string) => { const base = num(n); return base == null ? null : Math.round(base * (unit ? (/^m/i.test(unit) ? 1_000_000 : 1_000) : 1)); };
  // A labelled price first ("Offered at $1,595,000", "asking 799k"); otherwise the first dollar amount that isn't per
  // month, per year or per sqft (HOA dues, "Est. $8,912/mo") and isn't a past sale, estimate or tax figure.
  const labelled = t.match(/(?:offered at|list(?:ed)? (?:price|at)|asking|price[d]?(?: at)?:?)\s*\$\s?([\d,.]+)\s*(m|million|k)?/i)
    ?? t.match(/(?:offered at|asking|list price|priced at)\s*([\d,.]+)\s*(m|million|k)\b/i);
  if (labelled) price = toPrice(labelled[1], labelled[2]);
  if (price == null || price < 10_000) {
    price = null;
    for (const m of t.matchAll(/\$\s?([\d,.]+)\s*(m|million|k)?\b(?!\s*(?:\/|per|a)\s*(?:mo|month|yr|year|sq))/gi)) {
      if (/\b(sold|zestimate|estimate[sd]?|est\.?|tax(?:es)?|assessed|hoa|rent(?:al)?|history)\b[^$\n]{0,14}$/i.test(t.slice(Math.max(0, m.index! - 24), m.index))) continue;
      const v = toPrice(m[1], m[2]);
      if (v != null && v >= 10_000) { price = v; break; }
    }
  }
  // Counts as digits or words ("Three bedrooms, two baths"); "2 full baths and 1 half bath" is 2.5; a studio has 0 beds.
  const N = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight)';
  const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const count = (v: string) => (/^\d/.test(v) ? v : String(WORDS[v.toLowerCase()]));
  const bedM = t.match(new RegExp(`\\b${N}[- ]?(?:bed(?:room)?s?|br|bd)\\b`, 'i'));
  const beds = bedM ? [bedM[0], count(bedM[1])] : /\bstudio\b/i.test(t) ? [ 'studio', '0'] : null;
  const bathM = t.match(new RegExp(`\\b${N}[- ]?(?:full\\s+)?(?:bath(?:room)?s?|ba)\\b`, 'i'));
  const halfM = t.match(new RegExp(`\\b(one|a|1|two|2)\\s+half[- ]?bath(?:room)?s?\\b`, 'i'));
  const baths = bathM ? [bathM[0], String(Number(count(bathM[1])) + (halfM && !/\./.test(bathM[1]) && halfM.index! > bathM.index! ? (/^(two|2)$/i.test(halfM[1]) ? 1 : 0.5) : 0))] : null;
  // Living area, not the lot: skip a match with "lot" just before it or right after it.
  const sqft = [...t.matchAll(/([\d,]{3,7})\s*(?:\+\s*)?(?:sq\.?\s*ft|square feet|sf\b|sqft)\.?/gi)]
    .find((m) => !/\blot(?:\s+size)?\s*:?\s*$/i.test(t.slice(Math.max(0, m.index! - 16), m.index)) && !/^\s*(?:\w+\s+)?lot\b/i.test(t.slice(m.index! + m[0].length, m.index! + m[0].length + 12))) ?? null;
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
  if (namesOtherCity(clean) && !SF.test(clean.replace(/south san francisco/ig, ''))) return { ok: false, kind: 'outside_sf' };
  const regex = readListingRegex(clean);
  const agentEmail = clean.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? null; // no trailing sentence period
  const missing = !regex.address || regex.price == null || (regex.beds == null && regex.baths == null);
  if (!missing) return { ok: true, claims: regex, agentEmail };
  const digits = clean.replace(/[,\s]/g, '');
  // A number the model returns must be written in the text, as digits or in words ("two bedrooms", "1.35 million").
  const worded = /\b(one|two|three|four|five|six|seven|eight|nine|ten|half|hundred|thousand|million|m)\b/i.test(clean);
  const appears = (n: number | null) => n == null || digits.includes(String(n)) || clean.includes(String(n)) || worded;
  const { value } = await llmJson<ListingClaims & { city: string | null }>(SCHEMA,
    `Read this real estate listing and return only what it states. Use null for anything not stated. Do not infer.\n\nListing:\n${clean.slice(0, 6000)}`,
    () => ({ ...regex, city: null }),
    { timeoutMs: 45_000, first: true, validate: (v) => appears(v.beds) && appears(v.baths) && appears(v.units) },
  );
  // The model's city counts unless it is just the street's name ("2400 Sacramento St" -> city "Sacramento").
  if (value.city && !/san francisco|^sf$/i.test(value.city) && !(value.address ?? '').toLowerCase().includes(value.city.toLowerCase())) return { ok: false, kind: 'outside_sf' };
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
