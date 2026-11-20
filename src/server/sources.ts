import { soql, q, inList, getJson } from './http';
import type { ResolvedAddress } from './address';

/** Raw row types (only the fields the rules read). DataSF returns every value as a string. */
export type Row = Record<string, string | undefined>;

export interface RollRow extends Row { closed_roll_year?: string; number_of_units?: string; number_of_bathrooms?: string; number_of_bedrooms?: string; property_area?: string; lot_area?: string; year_property_built?: string; zoning_code?: string; assessed_land_value?: string; assessed_improvement_value?: string; current_sales_date?: string; use_definition?: string; assessor_neighborhood?: string; analysis_neighborhood?: string; homeowner_exemption_value?: string }

export interface Raw {
  roll: RollRow[];
  permits: Row[];        // i98e-djp9, deduped by permit_number
  permitsf: Row[];       // tyz3-vt28
  cfc: Row[];            // j67f-aayr
  housing: Row[];        // xdht-4php
  plumbing: Row[];       // a6aw-rudh
  electrical: Row[];     // ftty-kx6y
  plumbingInspections: Row[]; // fuas-yurr
  complaints: Row[];     // gm2e-bten
  novs: Row[];           // nbtm-fbw5
  planning: Row[];       // y673-d69b
  planningProjects: Row[]; // qvu5-m3a2
  zoning: Row[];         // 3i4a-hu95
  historic: Row[];       // 63x5-g3m4
  buyouts: Row[];        // wmam-7g8d
  hotelTax: Row[];       // g8m3-pdis (names are never read)
  nearbyProjects: Row[]; // qvu5-m3a2 within 150 m
  nearbyPermits: Row[];  // i98e-djp9 within 150 m
  streetPermits: Row[];  // fxfq-npa9 street-space permits on this frontage (no agent names read)
  hazards: Hazards;
  permitFacts?: Map<string, import('./permit-reader').PermitFacts>;
}

export interface Hazards {
  femaZone: string | null; femaSubtype: string | null;
  stormFlood: boolean | null;
  liquefaction: boolean | null;
  landslideZone: boolean | null;
  landslideClass: number | null;
  reservoirs: string[] | null;
  tsunami: boolean | null;
  seaLevel: boolean | null;
  maher: boolean | null;
}

const blockLotWhere = (a: ResolvedAddress, b = 'block', l = 'lot') => {
  const byBlock = new Map<string, string[]>();
  for (const p of a.parcels) byBlock.set(p.block, [...(byBlock.get(p.block) ?? []), p.lot]);
  return [...byBlock.entries()].map(([bk, lots]) => `(${b}=${q(bk)} AND ${l} in ${inList(lots)})`).join(' OR ');
};
const parcelIn = (a: ResolvedAddress, f = 'parcel_number') => `${f} in ${inList(a.parcels.map((p) => p.parcel))}`;
const point = (a: ResolvedAddress) => `POINT(${a.lon} ${a.lat})`;
const hits = (rows: Row[]) => rows.length > 0;

function dedupe(rows: Row[], key: string): Row[] {
  const seen = new Map<string, Row>();
  for (const r of rows) { const k = r[key]; if (k && !seen.has(k)) seen.set(k, r); }
  return [...seen.values()];
}

const NO_GEOM = (cols: string) => ({ select: cols });

/** Each step's fetch. Every function throws on failure; the pipeline turns that into a failed step. */
export const fetchers = {
  async roll(a: ResolvedAddress): Promise<RollRow[]> {
    // Condos can have hundreds of parcels: the roll is read for the listed unit's parcel (parcels[0]).
    const where = a.parcels.length > 1 ? `parcel_number=${q(a.parcels[0].parcel)}` : parcelIn(a);
    return soql<RollRow>('wv5m-vpq2', { where, order: 'closed_roll_year DESC', limit: 200 }, { label: 'roll' });
  },

  async permits(a: ResolvedAddress): Promise<Pick<Raw, 'permits' | 'permitsf' | 'cfc' | 'housing'>> {
    const [permitsRaw, permitsf, housing] = await Promise.all([
      soql('i98e-djp9', { where: blockLotWhere(a), order: 'filed_date DESC', limit: 5000 }, { label: 'permits' }),
      soql('tyz3-vt28', { where: parcelIn(a), limit: 1000 }, { label: 'permits' }).catch(() => [] as Row[]),
      soql('xdht-4php', { where: `blocklot in ${inList(a.parcels.map((p) => p.parcel))}`, limit: 200 }, { label: 'permits' }).catch(() => [] as Row[]),
    ]);
    const permits = dedupe(permitsRaw as Row[], 'permit_number');
    const nums = permits.map((p) => p.permit_number!).filter(Boolean);
    const cfc = nums.length
      ? await soql('j67f-aayr', { where: `building_permit_application in ${inList(nums.slice(0, 300))}`, limit: 1000 }, { label: 'permits' }).catch(() => [] as Row[])
      : [];
    return { permits, permitsf: permitsf as Row[], cfc: cfc as Row[], housing: housing as Row[] };
  },

  async trade(a: ResolvedAddress): Promise<Pick<Raw, 'plumbing' | 'electrical' | 'plumbingInspections'>> {
    const [plumbing, electrical, plumbingInspections] = await Promise.all([
      soql('a6aw-rudh', { where: blockLotWhere(a), limit: 2000 }, { label: 'trade_permits' }),
      soql('ftty-kx6y', { where: blockLotWhere(a), limit: 2000 }, { label: 'trade_permits' }),
      soql('fuas-yurr', { where: blockLotWhere(a), limit: 2000 }, { label: 'trade_permits' }).catch(() => [] as Row[]),
    ]);
    return { plumbing: dedupe(plumbing as Row[], 'permit_number'), electrical: dedupe(electrical as Row[], 'permit_number'), plumbingInspections: plumbingInspections as Row[] };
  },

  async complaints(a: ResolvedAddress): Promise<Pick<Raw, 'complaints' | 'novs'>> {
    const [complaints, novs] = await Promise.all([
      soql('gm2e-bten', { where: blockLotWhere(a), order: 'date_filed DESC', limit: 2000 }, { label: 'complaints' }),
      soql('nbtm-fbw5', { where: blockLotWhere(a), limit: 5000 }, { label: 'complaints' }),
    ]);
    return { complaints: dedupe(complaints as Row[], 'complaint_number'), novs: novs as Row[] };
  },

  async planning(a: ResolvedAddress): Promise<Pick<Raw, 'planning' | 'planningProjects'>> {
    const [planning, planningProjects] = await Promise.all([
      soql('y673-d69b', { where: blockLotWhere(a), limit: 1000 }, { label: 'planning' }),
      soql('qvu5-m3a2', { where: blockLotWhere(a), limit: 1000 }, { label: 'planning' }),
    ]);
    return { planning: planning as Row[], planningProjects: planningProjects as Row[] };
  },

  async zoning(a: ResolvedAddress): Promise<Pick<Raw, 'zoning' | 'historic'>> {
    if (a.lat == null) return { zoning: [], historic: [] };
    const where = `intersects(the_geom,'${point(a)}')`;
    const [zoning, historic] = await Promise.all([
      soql('3i4a-hu95', { where, ...NO_GEOM('zoning,zoning_sim,districtna,gen,codesectio') }, { label: 'zoning' }),
      soql('63x5-g3m4', { where, limit: 5 }, { label: 'zoning' }).catch(() => [] as Row[]),
    ]);
    return { zoning: zoning as Row[], historic: (historic as Row[]).map(({ the_geom: _g, ...r }) => r) };
  },

  async tenants(a: ResolvedAddress): Promise<Pick<Raw, 'buyouts' | 'hotelTax'>> {
    const n = Number(a.input.number);
    const street = a.streetName;
    const like = `${n} ${street}%`;
    const [buyouts, hotelTax] = await Promise.all([
      soql('wmam-7g8d', { where: `upper(address) like ${q(like)}`, limit: 50 }, { label: 'tenants' }),
      soql('g8m3-pdis', {
        where: `upper(full_business_address) like ${q(like)} AND transient_occupancy_tax=true`,
        select: 'uniqueid,full_business_address,location_start_date,location_end_date,dba_end_date,transient_occupancy_tax',
        limit: 50,
      }, { label: 'tenants' }),
    ]);
    // A loose LIKE can catch "2055 42ND" on a different street type; keep exact number matches only.
    const sameNumber = (s?: string) => !!s && new RegExp(`^${n}[A-Z]?\\s`, 'i').test(s.trim());
    return { buyouts: (buyouts as Row[]).filter((r) => sameNumber(r.address)), hotelTax: (hotelTax as Row[]).filter((r) => sameNumber(r.full_business_address)) };
  },

  async nearby(a: ResolvedAddress): Promise<Pick<Raw, 'nearbyProjects' | 'nearbyPermits' | 'streetPermits'>> {
    const street = soql('fxfq-npa9', {
      where: `upper(permit_address) like ${q(`${Number(a.input.number)} ${a.streetName}%`)} AND status='Active'`,
      select: 'permit_number,permit_type,status,permit_start_date,permit_end_date,permit_address,dbi_permit_number', limit: 50,
    }, { label: 'nearby' }).catch(() => [] as Row[]);
    if (a.lat == null) return { nearbyProjects: [], nearbyPermits: [], streetPermits: await street };
    const lots = await soql('acdm-wktn', { select: 'blklot,block_num,lot_num', where: `within_circle(shape, ${a.lat}, ${a.lon}, 150)`, limit: 1000 }, { label: 'nearby' });
    const own = new Set(a.parcels.map((p) => p.parcel));
    const blklots = new Set((lots as Row[]).map((r) => r.blklot!).filter((b) => b && !own.has(b)));
    const blocks = [...new Set((lots as Row[]).map((r) => r.block_num!).filter(Boolean))];
    const nowYear = new Date(process.env.HC_NOW ? Date.parse(process.env.HC_NOW) : Date.now()).getUTCFullYear();
    const since = `${nowYear - 2}-01-01`; // whole years keep the query (and its recording) stable
    const projects = blocks.length
      ? await soql('qvu5-m3a2', {
        where: `block in ${inList(blocks)} AND open_date > '${since}'`,
        select: 'record_id,record_type,project_name,description,record_status,project_address,block,lot,open_date,number_of_units_net,number_of_units_prop,number_of_units_exist,demolition,new_construction,adu',
        limit: 500,
      }, { label: 'nearby' })
      : [];
    const nearbyProjects = (projects as Row[]).filter((r) => blklots.has(`${r.block}${r.lot}`));
    return { nearbyProjects, nearbyPermits: [], streetPermits: await street };
  },

  async hazards(a: ResolvedAddress): Promise<Hazards> {
    const empty: Hazards = { femaZone: null, femaSubtype: null, stormFlood: null, liquefaction: null, landslideZone: null, landslideClass: null, reservoirs: null, tsunami: null, seaLevel: null, maher: null };
    if (a.lat == null) return empty;
    const where = `intersects(the_geom,'${point(a)}')`;
    const arc = (base: string) => `${base}/query?geometry=${a.lon},${a.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`;
    const opt = <T>(p: Promise<T>) => p.then((v) => v, () => null);
    const [fema, storm, liq, slide, slideClass, res, tsu, slr, maher] = await Promise.all([
      opt(getJson<{ features?: Array<{ attributes: Record<string, string> }> }>(arc('https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28'), { label: 'hazards', timeoutMs: 12_000 })),
      opt(soql('jzu3-4yxp', { where, select: 'count(*) as n' }, { label: 'hazards', timeoutMs: 15_000 })),
      opt(getJson<{ features?: unknown[] }>(arc('https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Liquefaction_Zones/FeatureServer/0'), { label: 'hazards' })),
      opt(getJson<{ features?: unknown[] }>(arc('https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Landslide_Zones/FeatureServer/0'), { label: 'hazards' })),
      opt(soql('bna4-itif', { where, select: 'gridcode' }, { label: 'hazards' })),
      opt(soql('7crf-46s6', { where, select: 'reservoir' }, { label: 'hazards' })),
      opt(soql('7p2k-c3z6', { where, select: 'count(*) as n' }, { label: 'hazards' })),
      opt(soql('esku-ejgv', { where, select: 'count(*) as n' }, { label: 'hazards' })),
      opt(soql('v5ic-hjgw', { where, select: 'count(*) as n' }, { label: 'hazards' })),
    ]);
    const count = (r: Row[] | null) => (r ? Number(r[0]?.n ?? 0) > 0 : null);
    const feat = (r: { features?: unknown[] } | null) => (r && Array.isArray(r.features) ? r.features.length > 0 : null);
    const out: Hazards = {
      femaZone: fema?.features?.[0]?.attributes?.FLD_ZONE ?? (fema ? null : null),
      femaSubtype: fema?.features?.[0]?.attributes?.ZONE_SUBTY ?? null,
      stormFlood: count(storm as Row[] | null),
      liquefaction: feat(liq),
      landslideZone: feat(slide),
      landslideClass: slideClass ? (slideClass as Row[]).reduce((m, r) => Math.max(m, Number(r.gridcode ?? 0)), 0) : null,
      reservoirs: res ? [...new Set((res as Row[]).map((r) => r.reservoir!).filter(Boolean))].sort() : null,
      tsunami: count(tsu as Row[] | null),
      seaLevel: count(slr as Row[] | null),
      maher: count(maher as Row[] | null),
    };
    if (out.femaZone == null && out.liquefaction == null && out.reservoirs == null && out.landslideClass == null) throw new Error('all hazard sources failed');
    return out;
  },
};

export { hits };
