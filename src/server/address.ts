import { soql, q, inList } from './http';

export interface ParsedAddress { number: string; suffix: string | null; street: string; type: string | null; display: string; unit?: string | null; alts?: string[] }

const TYPES: Record<string, string> = {
  st: 'ST', street: 'ST', ave: 'AVE', av: 'AVE', avenue: 'AVE', blvd: 'BLVD', boulevard: 'BLVD', way: 'WAY',
  ter: 'TER', terrace: 'TER', pl: 'PL', place: 'PL', dr: 'DR', drive: 'DR', ct: 'CT', court: 'CT', ln: 'LN', lane: 'LN',
  rd: 'RD', road: 'RD', aly: 'ALY', alley: 'ALY', cir: 'CIR', circle: 'CIR', hwy: 'HWY', plz: 'PLZ', plaza: 'PLZ', loop: 'LOOP', row: 'ROW', walk: 'WALK',
};
const TYPE_DISPLAY: Record<string, string> = { ST: 'St', AVE: 'Ave', BLVD: 'Blvd', WAY: 'Way', TER: 'Ter', PL: 'Pl', DR: 'Dr', CT: 'Ct', LN: 'Ln', RD: 'Rd', ALY: 'Aly', CIR: 'Cir', HWY: 'Hwy', PLZ: 'Plz', LOOP: 'Loop', ROW: 'Row', WALK: 'Walk' };

const ADDRESS_RE = new RegExp(
  String.raw`\b(\d{1,5})([A-Za-z])?\s+((?:\d{1,2}(?:st|nd|rd|th))|(?:[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,3}?))\s+(` +
    Object.keys(TYPES).join('|') + String.raw`)\b\.?`,
  'i',
);

function title(s: string): string {
  s = s.replace(/^0+(\d)/, '$1'); // DataSF writes 06TH; people write 6th
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, o) => n + o.toLowerCase())
    .replace(/\bO(farrell|shaughnessy|reilly|connor|neil)\b/, (_, r: string) => `O'${r[0].toUpperCase()}${r.slice(1)}`) // DataSF drops the apostrophe
    .split(' ').map((w, i, all) => (i > 0 && i < all.length - 1 && /^(Of|The)$/.test(w) ? w.toLowerCase() : w)).join(' '); // Avenue of the Palms
}

/** Finds the first street address in free text. Never guesses a street type that isn't written. */
// Streets the city writes without a type (Broadway, Avenue B, The Embarcadero, Avenue of the Palms), only when the
// name is followed by the city: "1000 Broadway, San Francisco". Listing words never count as a street.
const TYPELESS_RE = /\b(\d{1,5})([A-Za-z])?\s+((?:[A-Za-z][A-Za-z'.]*)(?:\s+[A-Za-z][A-Za-z'.]*){0,4}?)\s*,?\s*(?:#\s*[A-Za-z0-9-]{1,6}\s*,?\s*)?(?:San Francisco|SF|S\.F\.)\b/i;
const NOT_STREET = /^(bed|beds|bedroom|bedrooms|bath|baths|bathroom|bathrooms|br|ba|bd|unit|units|sq|sqft|ft|car|cars|story|stories|years?|homes?|condos?|flats?)\b/i;

// Listing prose that looks like an address: "5 min walk", "10 minute drive", "2 car parking lane", "1 block to the Way".
const PROSE_WORD = /\b(min|mins|minutes?|mile|blocks?|cars?|garage|parking|beds?|bedrooms?|baths?|bathrooms?|stor(?:y|ies)|units?|steps?|to|and|from|in|on|at|by|with|for|private|walking|quick|sq|ft)\b/i;
const ADDRESS_RE_G = new RegExp(ADDRESS_RE.source, 'gi');

export function parseAddress(text: string): ParsedAddress | null {
  let m: RegExpMatchArray | null = [...text.matchAll(ADDRESS_RE_G)].find((x) => !PROSE_WORD.test(x[3])) ?? null;
  if (!m) {
    const t = text.match(TYPELESS_RE);
    if (!t || NOT_STREET.test(t[3])) return null;
    m = Object.assign([t[0], t[1], t[2], t[3], ''], { index: t.index, input: t.input }) as RegExpMatchArray;
    // The unit (if any) sits between the name and the city; the code below reads it from the text after the street name.
    m[0] = `${t[1]}${t[2] ?? ''} ${t[3]}`;
  }
  const [, numberRaw, suffix, streetRaw, typeRaw] = m;
  // A number range ("1214-1216 Fell St", "1207-09 Fell St"): the first number, then the second if the first isn't on file.
  let number = numberRaw;
  let alts: string[] | undefined;
  const range = text.slice(Math.max(0, (m.index ?? 0) - 10), m.index ?? 0).match(/(\d{1,5})\s*[-–]\s*$/);
  if (range && !suffix) {
    const first = range[1];
    const second = numberRaw.length < first.length ? first.slice(0, first.length - numberRaw.length) + numberRaw : numberRaw;
    if (Number(second) > Number(first) && Number(second) - Number(first) <= 20) { number = first; alts = [second]; }
  }
  const street = streetRaw.trim().replace(/['’]/g, '').replace(/\s+/g, ' ').toUpperCase(); // DataSF: OFARRELL
  const type = typeRaw ? TYPES[typeRaw.toLowerCase()] ?? null : null;
  const display = `${number}${suffix ? suffix.toUpperCase() : ''} ${title(street)}${type ? ' ' + TYPE_DISPLAY[type] : ''}`;
  const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24);
  const unit = after.match(/^\s*,?\s*(?:#|unit\s+|apt\.?\s+|suite\s+|no\.\s*)(\d{1,5}\s?[A-Za-z](?![A-Za-z])|[A-Za-z0-9-]{1,6})\b/i)?.[1]?.toUpperCase().replace(/\s+/g, '') ?? null;
  return { number, suffix: suffix ? suffix.toUpperCase() : null, street, type, display, unit, ...(alts ? { alts } : {}) };
}

export interface ParcelRef { parcel: string; block: string; lot: string }

export interface ResolvedAddress {
  input: ParsedAddress;
  display: string;               // "2055 42nd Ave"
  parcels: ParcelRef[];          // every parcel on the base address (condos can have many); the listed unit's parcel first
  unit: string | null;           // "45E" when the listing names a unit
  units: string[];               // suffix and unit addresses on the base: ["2055A"]
  lat: number | null;
  lon: number | null;
  easBaseIds: string[];
  easIds: string[];
  cnn: string | null;
  neighborhood: string | null;
  streetName: string;            // as in city data: "42ND"
  streetType: string | null;     // "AVE"
}

interface AddrRow {
  eas_baseid?: string; eas_subid?: string; eas_address_id?: string; address_number?: string; address_number_suffix?: string;
  street_name?: string; street_type?: string; unit_number?: string; parcel_number?: string; block?: string; lot?: string;
  latitude?: string; longitude?: string; cnn?: string; nhood?: string;
}

export async function resolveAddress(a: ParsedAddress): Promise<ResolvedAddress | null> {
  for (const num of [a.number, ...(a.alts ?? [])]) {
    const r = await resolveOne(num === a.number ? a : { ...a, number: num, display: a.display.replace(/^\d+/, num) });
    if (r) return r;
  }
  return null;
}

async function resolveOne(a: ParsedAddress): Promise<ResolvedAddress | null> {
  // "Saint Francis" and "St Francis" are both written; try the other spelling when the first finds nothing.
  const alias = /^SAINT /.test(a.street) ? a.street.replace(/^SAINT /, 'ST ') : /^ST /.test(a.street) ? a.street.replace(/^ST /, 'SAINT ') : null;
  const names = [a.street, ...(alias ? [alias] : [])];
  let rows: AddrRow[] = [];
  for (const name of names) {
    const base = `address_number=${Number(a.number)} AND street_name=${q(name)}`;
    rows = await soql<AddrRow>('ramy-di5m', { where: a.type ? `${base} AND street_type=${q(a.type)}` : base, limit: 500 }, { label: 'parcel' });
    if (!rows.length && a.type) rows = await soql<AddrRow>('ramy-di5m', { where: base, limit: 500 }, { label: 'parcel' });
    if (rows.length) break;
  }
  if (!rows.length) return null;
  // Several street types can share a name (Carmelita St vs a Carmelita Ave elsewhere): the written type when it
  // exists here, otherwise the most common one ("Blvd" written for what the city calls a Way still resolves).
  const types = new Map<string, number>();
  for (const r of rows) types.set(r.street_type ?? '', (types.get(r.street_type ?? '') ?? 0) + 1);
  const type = a.type && types.has(a.type) ? a.type : [...types.entries()].sort((x, y) => y[1] - x[1])[0][0];
  rows = rows.filter((r) => (r.street_type ?? '') === (type ?? ''));
  if (!rows.length) return null;
  const baseIds = [...new Set(rows.map((r) => r.eas_baseid).filter(Boolean) as string[])];
  // Every unit on the base address, including condo units on other parcels.
  if (baseIds.length) {
    const all = await soql<AddrRow>('ramy-di5m', { where: `eas_baseid in ${inList(baseIds)}`, limit: 5000 }, { label: 'parcel' });
    if (all.length) rows = all;
  }
  const parcels = new Map<string, ParcelRef>();
  for (const r of rows) if (r.parcel_number && r.block && r.lot) parcels.set(r.parcel_number, { parcel: r.parcel_number, block: r.block, lot: r.lot });
  const units = [...new Set(rows.filter((r) => r.address_number_suffix || r.unit_number)
    .map((r) => `${r.address_number}${r.address_number_suffix ?? ''}${r.unit_number ? ' #' + r.unit_number : ''}`))];
  const norm = (u: string) => u.toUpperCase().replace(/[\s-]+/g, '');
  const unitRow = a.unit ? rows.find((r) => norm(r.unit_number ?? '') === norm(a.unit!)) : undefined;
  const first = unitRow ?? rows.find((r) => !r.address_number_suffix && !r.unit_number) ?? rows[0];
  const primary = first.parcel_number;
  return {
    input: a,
    display: `${a.number}${a.suffix ?? ''} ${title(a.street)}${type ? ' ' + (TYPE_DISPLAY[type] ?? title(type)) : ''}${unitRow ? ` #${a.unit}` : ''}`,
    parcels: [...parcels.values()].sort((x, y) => (x.parcel === primary ? -1 : y.parcel === primary ? 1 : x.parcel.localeCompare(y.parcel))),
    units,
    unit: unitRow ? a.unit ?? null : null,
    lat: first.latitude ? Number(first.latitude) : null,
    lon: first.longitude ? Number(first.longitude) : null,
    easBaseIds: baseIds,
    easIds: [...new Set(rows.map((r) => r.eas_address_id).filter(Boolean) as string[])],
    cnn: first.cnn ?? null,
    neighborhood: first.nhood ?? null,
    streetName: a.street,
    streetType: type || null,
  };
}

/** "2162-008", or "0863-007 and 3 more". Uses the block and lot fields, never a split by position. */
export function parcelDisplay(parcels: ParcelRef[]): string {
  if (!parcels.length) return '';
  const one = (p: ParcelRef) => `${p.block}-${p.lot}`;
  return parcels.length === 1 ? one(parcels[0]) : `${one(parcels[0])} and ${parcels.length - 1} more`;
}

/** For a model-returned address with no street type ("1200 Cole"): number + name; the resolver then matches any type. */
export function parseAddressLoose(input: string): ParsedAddress | null {
  const strict = parseAddress(input);
  if (strict) return strict;
  // "301 mission #45e, sf": take the unit and the city off, then number + name.
  let s = input.trim();
  const um = s.match(/\s*(?:#|\bunit\s+|\bapt\.?\s+|\bsuite\s+)\s*([A-Za-z0-9-]{1,6})\b/i);
  const unit = um ? um[1].toUpperCase() : null;
  if (um) s = s.slice(0, um.index) + s.slice(um.index! + um[0].length);
  s = s.replace(/[,\s]+(?:san francisco|sf|s\.f\.)\b.*$/i, '').replace(/[,\s]+(?:ca|california)\b.*$/i, '').trim();
  const m = s.match(/^(\d{1,5})([A-Za-z])?\s+([A-Za-z0-9][A-Za-z0-9 .'-]{1,40}?)\s*(?:,|$)/);
  if (!m) return null;
  const street = m[3].trim().toUpperCase().replace(/\s+/g, ' ');
  if (NOT_STREET.test(street)) return null;
  return { number: m[1], suffix: m[2]?.toUpperCase() ?? null, street, type: null, display: `${m[1]}${m[2]?.toUpperCase() ?? ''} ${title(street)}`, unit };
}

/** A typed address and nothing else ("57 carmelita", "301 mission #45e, sf"). Anything after the street name other
 *  than a unit, SF, CA or a zip ("12 Main St Novato") means it isn't bare, so the caller reads it the long way. */
export function bareAddress(text: string): ParsedAddress | null {
  const t = text.trim();
  if (t.length > 80 || /\n/.test(t) || /\$|\b(bed|beds|bath|baths|bd|ba|br|sq|units?|price)\b/i.test(t)) return null;
  const a = parseAddressLoose(t);
  if (!a) return null;
  const tail = t.replace(/\s*(?:#|\bunit\s+|\bapt\.?\s+|\bsuite\s+)\s*[A-Za-z0-9-]{1,6}\b/i, '')
    .replace(/\b(?:san francisco|sf|s\.f\.|ca|california|9\d{4})\b/gi, '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim();
  const last = (tail.split(/\s+/).pop() ?? '').toLowerCase();
  const nameEnd = a.street.split(' ').pop()!.toLowerCase();
  return last === nameEnd || (a.type && TYPES[last] === a.type) ? a : null;
}
