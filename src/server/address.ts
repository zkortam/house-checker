import { soql, q, inList } from './http';

export interface ParsedAddress { number: string; suffix: string | null; street: string; type: string | null; display: string; unit?: string | null }

const TYPES: Record<string, string> = {
  st: 'ST', street: 'ST', ave: 'AVE', av: 'AVE', avenue: 'AVE', blvd: 'BLVD', boulevard: 'BLVD', way: 'WAY',
  ter: 'TER', terrace: 'TER', pl: 'PL', place: 'PL', dr: 'DR', drive: 'DR', ct: 'CT', court: 'CT', ln: 'LN', lane: 'LN',
  rd: 'RD', road: 'RD', aly: 'ALY', alley: 'ALY', cir: 'CIR', circle: 'CIR', hwy: 'HWY', plz: 'PLZ', plaza: 'PLZ',
};
const TYPE_DISPLAY: Record<string, string> = { ST: 'St', AVE: 'Ave', BLVD: 'Blvd', WAY: 'Way', TER: 'Ter', PL: 'Pl', DR: 'Dr', CT: 'Ct', LN: 'Ln', RD: 'Rd', ALY: 'Aly', CIR: 'Cir', HWY: 'Hwy', PLZ: 'Plz' };

const ADDRESS_RE = new RegExp(
  String.raw`\b(\d{1,5})([A-Za-z])?\s+((?:\d{1,2}(?:st|nd|rd|th))|(?:[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,2}?))\s+(` +
    Object.keys(TYPES).join('|') + String.raw`)\b\.?`,
  'i',
);

function title(s: string): string {
  s = s.replace(/^0+(\d)/, '$1'); // DataSF writes 06TH; people write 6th
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, o) => n + o.toLowerCase())
    .replace(/\bO(farrell|shaughnessy|reilly|connor|neil)\b/, (_, r: string) => `O'${r[0].toUpperCase()}${r.slice(1)}`); // DataSF drops the apostrophe
}

/** Finds the first street address in free text. Never guesses a street type that isn't written. */
export function parseAddress(text: string): ParsedAddress | null {
  const m = text.match(ADDRESS_RE);
  if (!m) return null;
  const [, number, suffix, streetRaw, typeRaw] = m;
  const street = streetRaw.trim().replace(/['’]/g, '').replace(/\s+/g, ' ').toUpperCase(); // DataSF: OFARRELL
  const type = TYPES[typeRaw.toLowerCase()] ?? null;
  const display = `${number}${suffix ? suffix.toUpperCase() : ''} ${title(street)}${type ? ' ' + TYPE_DISPLAY[type] : ''}`;
  const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 24);
  const unit = after.match(/^\s*,?\s*(?:#|unit\s+|apt\.?\s+|suite\s+|no\.\s*)(\d{1,5}\s?[A-Za-z](?![A-Za-z])|[A-Za-z0-9-]{1,6})\b/i)?.[1]?.toUpperCase().replace(/\s+/g, '') ?? null;
  return { number, suffix: suffix ? suffix.toUpperCase() : null, street, type, display, unit };
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
export function parseAddressLoose(s: string): ParsedAddress | null {
  const strict = parseAddress(s);
  if (strict) return strict;
  const m = s.trim().match(/^(\d{1,5})([A-Za-z])?\s+([A-Za-z0-9][A-Za-z0-9 .'-]{1,40}?)\s*(?:,|$)/);
  if (!m) return null;
  const street = m[3].trim().toUpperCase().replace(/\s+/g, ' ');
  return { number: m[1], suffix: m[2]?.toUpperCase() ?? null, street, type: null, display: `${m[1]}${m[2]?.toUpperCase() ?? ''} ${title(street)}`, unit: null };
}
