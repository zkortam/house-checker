import type { Source } from '../contract/types';
import type { ParcelRef } from './address';
import type { Row } from './sources';

/** Source registry: numbers sources in order of first citation, so every [n] points at a real record. */
export class Cites {
  list: Source[] = [];
  private index = new Map<string, number>();
  n(src: Source): number {
    const have = this.index.get(src.id);
    if (have) return have;
    this.list.push(src);
    this.index.set(src.id, this.list.length);
    return this.list.length;
  }
  c(...srcs: Array<Source | null | undefined>): string {
    return srcs.filter(Boolean).map((s) => `[${this.n(s!)}]`).join('');
  }
  has(id: string): boolean { return this.index.has(id); }
  get(id: string): Source | undefined { const i = this.index.get(id); return i ? this.list[i - 1] : undefined; }
}

const R = 'https://data.sf.gov/resource/';
const D = 'https://data.sf.gov/d/';
const day = (s?: string | null) => (s ? s.slice(0, 10) : null);

export function shortWhat(desc: string | undefined, fallback: string): string {
  const d = (desc ?? '').toLowerCase();
  if (/legaliz/.test(d) && /(dwelling|unit|adu)/.test(d)) return 'ADU legalization';
  if (/\badu\b|accessory dwelling/.test(d)) return 'ADU';
  if (/re-?roof|roofing/.test(d)) return 'reroof';
  if (/bedroom.*office|office/.test(d)) return 'bedroom to office';
  if (/foundation|shoring|grade beam/.test(d)) return 'foundation';
  if (/excavat/.test(d)) return 'excavation';
  if (/sewer|lateral/.test(d)) return 'sewer lateral';
  if (/bath/.test(d)) return 'baths';
  if (/kitchen/.test(d)) return 'kitchen';
  if (/remodel|renovat/.test(d)) return 'remodel';
  if (/illegal unit|udu|in-?law|unauthori[sz]ed unit/.test(d)) return 'illegal unit';
  return fallback;
}

export const S = {
  roll: (parcel: string, year: string): Source => ({
    id: `roll:${parcel}:${year}`, title: `Assessor's roll ${year}, parcel ${parcel}`, publisher: 'SF Assessor-Recorder', date: `${year}-01-01`,
    url: `${R}wv5m-vpq2.json?parcel_number=${parcel}&closed_roll_year=${year}`, dataset: 'wv5m-vpq2',
  }),
  permit: (p: Row): Source => ({
    id: `permit:${p.permit_number}`, title: `Building permit ${p.permit_number}, ${shortWhat(p.description, 'building work')}`, publisher: 'DBI',
    date: day(p.completed_date ?? p.issued_date ?? p.filed_date), url: `${R}i98e-djp9.json?permit_number=${p.permit_number}`, dataset: 'i98e-djp9',
  }),
  plumbing: (p: Row, what?: string): Source => ({
    id: `plumbing:${p.permit_number}`, title: `Plumbing permit ${p.permit_number}, ${what ?? shortWhat(p.description, 'plumbing')}`, publisher: 'DBI',
    date: day(p.completed_date) ?? (p.issued_date ? p.issued_date.slice(0, 4) : null), url: `${R}a6aw-rudh.json?permit_number=${p.permit_number}`, dataset: 'a6aw-rudh',
  }),
  electrical: (parcel: ParcelRef, year: string | null): Source => ({
    id: `electrical:${parcel.parcel}`, title: `Electrical permits, block ${parcel.block} lot ${parcel.lot}`, publisher: 'DBI', date: year,
    url: `${R}ftty-kx6y.json?block=${parcel.block}&lot=${parcel.lot}`, dataset: 'ftty-kx6y',
  }),
  cfc: (r: Row): Source => ({
    id: `cfc:${r.building_permit_application}`, title: `Certificate of final completion, ${(r.building_address ?? '').replace(/\s+(Avenue|Street)$/i, '').trim() || r.building_permit_application}`,
    publisher: 'DBI', date: day(r.date_issued), url: `${R}j67f-aayr.json?building_permit_application=${r.building_permit_application}`, dataset: 'j67f-aayr',
  }),
  complaint: (c: Row): Source => ({
    id: `complaint:${c.complaint_number}`, title: `Complaint ${c.complaint_number}, ${shortWhat(c.complaint_description ?? c.code_violation_desc, 'building')}`, publisher: 'DBI',
    date: day(c.date_filed), url: `${R}gm2e-bten.json?complaint_number=${c.complaint_number}`, dataset: 'gm2e-bten',
  }),
  planning: (r: Row): Source => ({
    id: `planning:${r.record_id}`, title: `Planning ${/ENF|PIC/.test(r.record_id ?? '') ? 'case' : 'project'} ${r.record_id}${r.project_name && !/ENF|PIC/.test(r.record_id ?? '') ? ', ' + titleCase(r.project_name) : ''}`,
    publisher: 'SF Planning', date: day(r.open_date),
    url: /ENF|PIC/.test(r.record_id ?? '') ? `https://sfplanninggis.org/pim?search=${r.record_id}` : `${R}qvu5-m3a2.json?record_id=${r.record_id}`,
    dataset: /ENF|PIC/.test(r.record_id ?? '') ? 'y673-d69b' : 'qvu5-m3a2',
  }),
  planningParcel: (p: { parcel: string; block: string; lot: string }, year: string | null): Source => ({
    id: `planning:${p.parcel}`, title: `Planning records, block ${p.block} lot ${p.lot}`, publisher: 'SF Planning', date: year,
    url: `${R}y673-d69b.json?block=${p.block}&lot=${p.lot}`, dataset: 'y673-d69b',
  }),
  hazards: (parcel: string): Source => ({
    id: `hazards:${parcel}`, title: 'FEMA flood map, state seismic hazard and tsunami zones', publisher: 'FEMA, California Geological Survey', date: '2021',
    url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28',
  }),
  stormflood: (parcel: string): Source => ({ id: `stormflood:${parcel}`, title: '100-year storm flood risk zone', publisher: 'SFPUC', date: '2022-07', url: D + 'jzu3-4yxp', dataset: 'jzu3-4yxp' }),
  sealevel: (parcel: string): Source => ({ id: `sealevel:${parcel}`, title: 'Sea level rise maps, 24 and 66 inches', publisher: 'SF Planning', date: '2020', url: D + 'esku-ejgv', dataset: 'esku-ejgv' }),
  maher: (parcel: string): Source => ({ id: `maher:${parcel}`, title: 'Maher soil and groundwater ordinance area', publisher: 'SF Public Health', date: null, url: D + 'v5ic-hjgw', dataset: 'v5ic-hjgw' }),
  reservoir: (parcel: string): Source => ({ id: `reservoir:${parcel}`, title: 'Reservoir failure inundation zones', publisher: 'SFPUC', date: null, url: D + '7crf-46s6', dataset: '7crf-46s6' }),
  landslide: (parcel: string): Source => ({ id: `landslide:${parcel}`, title: 'Landslide susceptibility map', publisher: 'SF Planning', date: null, url: D + 'bna4-itif', dataset: 'bna4-itif' }),
  historic: (parcel: string, name: string): Source => ({ id: `historic:${parcel}`, title: `Historic districts, ${name.replace(/ Historic District$/i, '')}`, publisher: 'SF Planning', date: null, url: D + '63x5-g3m4', dataset: '63x5-g3m4' }),
  buyout: (b: Row, address: string, like: string): Source => ({
    id: `buyout:${b.case_number}`, title: `Tenant buyout declaration ${b.case_number}`, publisher: 'SF Rent Board', date: day(b.buyout_agreement_date ?? b.pre_buyout_disclosure_declaration_date),
    url: R + 'wmam-7g8d.json?$where=' + encodeURIComponent(`upper(address) like '${like}'`), dataset: 'wmam-7g8d',
  }),
  street: (parcel: string, address: string): Source => ({ id: `street:${parcel}`, title: `Street-space permits, ${address}`, publisher: 'SF Public Works', date: null, url: D + 'fxfq-npa9', dataset: 'fxfq-npa9' }),
  lineage: (parcel: string, old: string, date: string | null): Source => ({
    id: `lineage:${parcel}:${old}`, title: `Lot history: parcel ${parcel} created from ${old}`, publisher: 'SF Public Works, mapping', date,
    url: `${R}nqyt-nfmd.json?blklot=${parcel}`, dataset: 'nqyt-nfmd',
  }),
  parentPermit: (p: Row): Source => ({
    id: `permit:${p.permit_number}`, title: `Building permit ${p.permit_number}, parent lot ${p.block}${p.lot}, ${shortWhat(p.description, 'building work')}`, publisher: 'DBI',
    date: day(p.completed_date ?? p.issued_date ?? p.filed_date), url: `${R}i98e-djp9.json?permit_number=${p.permit_number}`, dataset: 'i98e-djp9',
  }),
  noBuyout: (parcel: string): Source => ({ id: `buyout:${parcel}`, title: 'Tenant buyout declarations', publisher: 'SF Rent Board', date: null, url: D + 'wmam-7g8d', dataset: 'wmam-7g8d' }),
  hotelTax: (slug: string, address: string, start: string | null): Source => ({
    id: `business:hotel-tax:${slug}`, title: `Registered businesses with hotel tax, ${address}`, publisher: 'SF Treasurer and Tax Collector', date: start, url: D + 'g8m3-pdis', dataset: 'g8m3-pdis',
  }),
  taxRate: (): Source => ({ id: 'tax:rate:2026-27', title: 'Tax rate resolution, FY 2026-27', publisher: 'Board of Supervisors', date: '2026-09-22', url: 'https://media.api.sf.gov/documents/r0524-26.pdf' }),
  supplemental: (): Source => ({ id: 'tax:supplemental', title: 'Supplemental assessments', publisher: 'SF Assessor-Recorder', date: '2026', url: 'https://www.sf.gov/information--learn-about-supplemental-assessments' }),
  transfer: (): Source => ({
    id: 'tax:transfer', title: 'Who pays what: California transfer taxes', publisher: 'Fidelity National Financial', date: '2026-01-06',
    url: 'https://page.fnf.com/rs/393-REY-847/images/Who%20Pays%20What%20-%20California%20Transfer%20Tax%20and%20Fees%20%28rev%2001062026%29.pdf',
  }),
  dbiFees: (): Source => ({
    id: 'fees:dbi:2026', title: 'Penalties and code enforcement fees 2026', publisher: 'DBI', date: '2026-07-12',
    url: 'https://media.api.sf.gov/documents/Table_1A-K_-_Penalities_Hearings_Code_Enforcement_Assessments_2026.pdf',
  }),
};

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, o) => n + o.toLowerCase());
}
