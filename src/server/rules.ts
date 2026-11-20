import type {
  CaseRow, ClaimRow, CostRow, Decision, EmailDraft, FindingLabel, GlanceTile, HazardCheck, HistoryRow, InfoRow, ListingClaims,
  MoneyInputs, Report, SectionKey, SectionState, SystemRow, Tone, Unknown,
} from '../contract/types';
import { LABELS } from '../contract/labels';
import { computeCosts } from '../contract/money';
import type { ResolvedAddress } from './address';
import { parcelDisplay } from './address';
import { Cites, S, shortWhat, titleCase } from './cite';
import type { Hazards, Raw, RollRow, Row } from './sources';

/**
 * A6/A7/A8: deterministic rules. Code decides every label and number; prose here is the rule's own sentence,
 * which the writer (writer.ts) may replace with a checked model sentence.
 */

export type StepKey = 'parcel' | 'roll' | 'permits' | 'trade_permits' | 'complaints' | 'planning' | 'zoning' | 'tenants' | 'hazards' | 'nearby' | 'money';

export interface RuleInput {
  listingText: string;
  claims: ListingClaims;
  agentEmail: string | null;
  addr: ResolvedAddress;
  raw: Partial<Raw>;
  failed: Set<StepKey>;
  now: Date;
  reportId: string;
  closing?: Date;
}

/* ---------- small helpers ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!m) return String(y);
  if (!d) return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
const year = (iso?: string | null) => (iso ? Number(iso.slice(0, 4)) : null);
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const n = (s?: string | null) => (s == null || s === '' ? null : Number(s));
const int = (x: number) => new Intl.NumberFormat('en-US').format(Math.round(x));
const money = (x: number) => '$' + int(x);
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (x: number) => WORD[x] ?? String(x);
/** Ledger cells hold at most 14 characters: "245,700 to 295,521" becomes "246k to 296k". */
const fit14 = (t: string) => (t.length <= 14 ? t : t.replace(/\d{1,3}(?:,\d{3})+/g, (m) => `${Math.round(Number(m.replace(/,/g, '')) / 1000)}k`));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lower = (s?: string) => (s ?? '').toLowerCase();
const isComplete = (p: Row) => /complete|finaled/i.test(p.status ?? '') || (!!p.completed_date && !/cancel|withdraw|expired/i.test(p.status ?? ''));
const isLive = (p: Row) => /issued|filed|approved|reinstated|plancheck|triage/i.test(p.status ?? '') && !p.completed_date;
const ILLEGAL_UNIT = /illegal unit|illegal in-?law|udu|unauthori[sz]ed (dwelling )?unit|unwarranted unit|in-?law unit|illegal dwelling|garage unit/;
const BATH_COUNT = /(\d+|one|two|three|four|five)\s+(?:new\s+|full\s+|half\s+)?(?:bath(?:room)?s?)\b/i;
const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function bathsIn(desc: string): { count: number; added: boolean } | null {
  const d = lower(desc);
  if (/in[- ]kind/.test(d)) return null;
  const m = d.match(BATH_COUNT);
  const added = /\b(add|adding|added|new)\b[^.]*bath/.test(d);
  if (m) { const c = /^\d/.test(m[1]) ? Number(m[1]) : WORDNUM[m[1]] ?? 0; return { count: c, added: /\badd(ing|ed)?\b/.test(d) && !/remodel/.test(d) }; }
  if (added && /\bbath(room)?\b/.test(d)) return { count: 1, added: true };
  return null;
}

/* ---------- the rules ---------- */

export function buildReport(input: RuleInput): Report {
  const { claims, addr, raw, failed } = input;
  const cites = new Cites();
  const c = cites.c.bind(cites);
  const P = addr.parcels[0];
  const pid = P?.parcel ?? 'unknown';
  // Condos: the roll row for the listed unit's parcel (parcels[0]), not whichever unit sorts first.
  const allRoll = (raw.roll ?? []) as RollRow[];
  const rollRows = allRoll.some((r) => r.parcel_number === pid) ? allRoll.filter((r) => r.parcel_number === pid) : allRoll;
  const multiParcel = addr.parcels.length > 1;
  const latestYear = rollRows.reduce((m, r) => Math.max(m, Number(r.closed_roll_year ?? 0)), 0);
  const roll = rollRows.find((r) => Number(r.closed_roll_year) === latestYear) ?? null;
  const rollSrc = roll ? S.roll(roll.parcel_number ?? pid, String(latestYear)) : null;
  // An address-only check has no ledger to cite the roll first, so it would show up as [15] in the opening answer.
  if (rollSrc && claims.units == null && claims.beds == null && claims.baths == null && claims.sqft == null && !claims.adu && !claims.renovations?.length) cites.n(rollSrc);
  const lien = latestYear ? `${latestYear}-01-01` : null;
  const yearBuilt = n(roll?.year_property_built) || null;
  const lotSqft = n(roll?.lot_area) || null;
  const rollUnits = n(roll?.number_of_units);
  // The roll writes 0 when it has no count: "0 baths" on a home means not recorded, not none.
  const rollBaths = n(roll?.number_of_bathrooms) || null;
  const rollBeds = n(roll?.number_of_bedrooms) || null;
  const rollArea = n(roll?.property_area) || null;

  const permits = [...(raw.permits ?? [])].sort((a, b) => (b.filed_date ?? '').localeCompare(a.filed_date ?? ''));
  const cfcs = raw.cfc ?? [];
  const plumbing = raw.plumbing ?? [];
  const electrical = raw.electrical ?? [];
  const complaints = raw.complaints ?? [];
  const novs = raw.novs ?? [];
  const planning = raw.planning ?? [];
  const projects = raw.planningProjects ?? [];
  const zoningRow = raw.zoning?.[0];
  const zoning = zoningRow?.zoning_sim ?? zoningRow?.zoning ?? (roll?.zoning_code ? roll.zoning_code.replace(/^([A-Z]+)(\d)/, '$1-$2') : null);
  const historic = (raw.historic ?? []).find((h) => /listed/i.test(h.a10 ?? '') || /listed/i.test(h.a11 ?? '')) ?? null;

  /* ----- complaint history about an illegal unit ----- */
  const complaintText = (cn: Row) => lower(`${cn.complaint_description ?? ''} ${novs.filter((v) => v.complaint_number === cn.complaint_number).map((v) => `${v.code_violation_desc ?? ''} ${v.item ?? ''}`).join(' ')}`);
  const unitComplaints = complaints.filter((cn) => ILLEGAL_UNIT.test(complaintText(cn)) || /nov\s*#?\s*\d+/.test(lower(cn.complaint_description)) && ILLEGAL_UNIT.test(lower(cn.complaint_description)))
    .sort((a, b) => (a.date_filed ?? '').localeCompare(b.date_filed ?? ''));
  // Amendments to an earlier NOV ("amendment to nov 201488731") belong to the same issue.
  for (const cn of complaints) {
    const ref = lower(cn.complaint_description).match(/amendment to nov\s*#?\s*(\d+)/);
    if (ref && unitComplaints.some((u) => u.complaint_number === ref[1]) && !unitComplaints.includes(cn)) unitComplaints.push(cn);
  }
  unitComplaints.sort((a, b) => (a.date_filed ?? '').localeCompare(b.date_filed ?? ''));
  const firstUnitComplaint = unitComplaints[0] ?? null;

  /* ----- unit timeline: completed unit-changing permits, then certificates, then Housing Production ----- */
  const unitPermits = permits.filter((p) => n(p.existing_units) != null && n(p.proposed_units) != null && n(p.existing_units) !== n(p.proposed_units));
  const completedUnit = unitPermits.filter(isComplete).sort((a, b) => (a.completed_date ?? '').localeCompare(b.completed_date ?? ''));
  const liveUnit = unitPermits.filter(isLive);
  const lastUnitPermit = completedUnit[completedUnit.length - 1] ?? null;
  const unitCfc = lastUnitPermit ? cfcs.find((x) => x.building_permit_application === lastUnitPermit.permit_number) ?? null : null;
  const housingRow = (raw.housing ?? []).find((h) => n(h.net_units_completed)) ?? null;
  let recordUnits: number | null = lastUnitPermit ? n(lastUnitPermit.proposed_units) : null;
  if (recordUnits == null) {
    // A permit with 0 proposed units is usually a commercial or partial-scope filing, not the building's count.
    const latestWithUnits = permits.filter(isComplete).find((p) => (n(p.proposed_units) ?? 0) > 0);
    recordUnits = latestWithUnits ? n(latestWithUnits.proposed_units) : rollUnits && rollUnits > 0 ? rollUnits : null;
  }
  const unitLegalized = !!lastUnitPermit && /legaliz|adu/.test(lower(lastUnitPermit.description));

  /* ----- ledger ----- */
  const ledger: ClaimRow[] = [];
  const listingUnits = claims.units;

  // "4 bed with legal ADU" and no unit count, on a lot the city counts as two legal units: the in-law is the second unit.
  const aduIsSecondUnit = listingUnits == null && !!claims.adu && !unitLegalized && (recordUnits ?? rollUnits ?? 1) === 2;

  // Units
  // A condo listing that says "1 unit" describes the unit itself, not the building: nothing to compare.
  const condoSelf = multiParcel && !!addr.unit && listingUnits === 1 && !claims.adu;
  if (!condoSelf && (listingUnits != null || claims.adu)) {
    const lu = listingUnits ?? 1;
    const adu = claims.adu;
    if (lastUnitPermit && recordUnits != null && lu === recordUnits) {
      const after = !lien || day(lastUnitPermit.completed_date) >= lien || (rollUnits ?? 0) < recordUnits;
      const label: FindingLabel = (rollUnits ?? 0) === recordUnits ? 'matches' : after ? 'permitted_not_updated' : 'matches';
      const permitSrc = S.permit(lastUnitPermit);
      ledger.push({
        key: 'units', title: 'Units', listing: String(lu), records: String(recordUnits), label,
        why: label === 'permitted_not_updated'
          ? `Permit ${lastUnitPermit.permit_number} ${unitLegalized ? 'legalized the ground-floor unit under the ADU program' : `changed the building from ${lastUnitPermit.existing_units?.replace('.0', '')} to ${recordUnits} units`} and closed with a certificate of final completion on ${fmtDate(unitCfc?.date_issued ?? lastUnitPermit.completed_date)} ${c(permitSrc, unitCfc ? S.cfc(unitCfc) : null)}. The assessor's roll is a snapshot from ${fmtDate(lien)}, before that work finished ${c(rollSrc)}.`
          : `Permit ${lastUnitPermit.permit_number} set the building at ${recordUnits} units ${c(permitSrc, unitCfc ? S.cfc(unitCfc) : null)}, and the assessor agrees ${c(rollSrc)}.`,
      });
    } else if (aduIsSecondUnit) {
      ledger.push({
        key: 'units', title: 'Units', listing: '1 plus in-law', records: '2', label: 'matches',
        why: `City records count two legal units ${c(rollSrc)}, so the in-law can be the second one.`,
      });
    } else if (adu && !unitLegalized && (listingUnits == null || listingUnits === (recordUnits ?? rollUnits ?? 1))) {
      const base = recordUnits ?? rollUnits ?? 1;
      ledger.push({
        key: 'units', title: 'Units', listing: `${lu} plus in-law`, records: String(base), label: 'records_differ',
        why: `The listing counts an in-law on top of ${lu} unit${lu === 1 ? '' : 's'}. City records show ${base} legal unit${base === 1 ? '' : 's'} ${c(rollSrc)}.`,
      });
    } else if (recordUnits != null) {
      const live = liveUnit[0];
      const label: FindingLabel = lu === recordUnits ? 'matches' : live && n(live.proposed_units) === lu ? 'permitted_not_finaled' : lu > recordUnits ? 'no_permit_found' : 'records_differ';
      ledger.push({
        key: 'units', title: 'Units', listing: String(lu), records: String(recordUnits), label,
        why: label === 'matches' ? `Records show ${recordUnits} unit${recordUnits === 1 ? '' : 's'} ${c(rollSrc)}.`
          : label === 'permitted_not_finaled' ? `Permit ${live.permit_number} would make ${lu} units but is not signed off ${c(S.permit(live))}.`
          : label === 'no_permit_found' ? `No permit adds a unit beyond the ${recordUnits} on record ${c(rollSrc)}.${firstUnitComplaint ? ` A ${year(firstUnitComplaint.date_filed)} complaint described an illegal unit ${c(S.complaint(firstUnitComplaint))}.` : ''}`
          : `The listing says ${lu}, records show ${recordUnits} ${c(rollSrc)}.`,
      });
    } else if (listingUnits != null) {
      ledger.push({ key: 'units', title: 'Units', listing: String(lu), records: null, label: 'not_settled', why: 'No city record gives the unit count. Ask the seller for the 3R report, which shows the legal use.' });
    }
  }

  // Baths
  // In a multi-parcel building, trade permits are building-wide and can't be pinned to the listed unit.
  const unitPlumbing = multiParcel ? [] : plumbing;
  const finaledBaths = unitPlumbing.filter(isComplete).map((p) => ({ p, b: bathsIn(p.description ?? '') })).filter((x) => x.b && (!lien || day(x.p.completed_date) >= `${(latestYear || 2000) - 3}-01-01`));
  const liveBaths = unitPlumbing.filter((p) => !isComplete(p) && /issued|filed/i.test(p.status ?? '')).map((p) => ({ p, b: bathsIn(p.description ?? '') })).filter((x) => x.b);
  if (claims.baths != null) {
    const mentioned = finaledBaths.filter((x) => !x.b!.added).reduce((s, x) => s + x.b!.count, 0);
    const added = finaledBaths.filter((x) => x.b!.added).reduce((s, x) => s + x.b!.count, 0);
    const recBaths = finaledBaths.length ? Math.max((rollBaths ?? 0) + added, mentioned) : rollBaths;
    const srcs = finaledBaths.map((x) => S.plumbing(x.p, /adu/i.test(x.p.description ?? '') ? 'ADU baths' : /2\/f|2nd|upstairs|second/i.test(x.p.description ?? '') ? 'upstairs baths' : 'baths'));
    let label: FindingLabel;
    let why: string;
    if (recBaths != null && claims.baths === recBaths && finaledBaths.length && rollBaths !== recBaths) {
      label = 'permitted_not_updated';
      const when = finaledBaths.map((x) => x.p.completed_date).sort().pop();
      why = `${cap(word(finaledBaths.length))} plumbing permit${finaledBaths.length > 1 ? 's' : ''} passed final inspection on ${fmtDate(when)}: ${finaledBaths.map((x) => `${word(x.b!.count)} bath${x.b!.count > 1 ? 's' : ''} ${/adu/i.test(x.p.description ?? '') ? 'in the ADU' : /2\/f|2nd|upstairs|second/i.test(x.p.description ?? '') ? 'upstairs' : x.b!.added ? 'added' : 'redone'}`).join(' and ')} ${c(...srcs)}. The assessor still records ${rollBaths ?? 'no'} bath${rollBaths === 1 ? '' : 's'} ${c(rollSrc)}.`;
    } else if (recBaths != null && claims.baths === recBaths) {
      label = 'matches';
      why = `The assessor records ${recBaths} bath${recBaths === 1 ? '' : 's'} ${c(rollSrc)}${srcs.length ? `, and plumbing finals agree ${c(...srcs)}` : ''}.`;
    } else if (liveBaths.length && claims.baths > (recBaths ?? 0)) {
      label = 'permitted_not_finaled';
      const lb = liveBaths[0];
      why = `Plumbing permit ${lb.p.permit_number} covers ${word(lb.b!.count)} bath${lb.b!.count > 1 ? 's' : ''} and is issued, not final ${c(S.plumbing(lb.p, `${word(lb.b!.count)} bath${lb.b!.count > 1 ? 's' : ''}`))}. The assessor records ${rollBaths ?? 'no'} ${c(rollSrc)}.`;
    } else if (recBaths != null && claims.baths > recBaths) {
      label = 'no_permit_found';
      why = `The assessor records ${recBaths} bath${recBaths === 1 ? '' : 's'} ${c(rollSrc)}, and no plumbing permit adds one.`;
    } else {
      label = recBaths == null ? 'not_settled' : 'records_differ';
      why = recBaths == null ? 'The assessor leaves baths blank and no plumbing permit settles it.' : `The listing says ${claims.baths}, the assessor records ${recBaths} ${c(rollSrc)}.`;
    }
    const recText = label === 'permitted_not_finaled' ? `${liveBaths[0].b!.count} permitted` : recBaths != null ? String(recBaths) : null;
    ledger.push({ key: 'baths', title: 'Baths', listing: String(claims.baths), records: recText, label, why });
  }

  // Sq ft
  if (claims.sqft != null) {
    const proj = multiParcel ? undefined : projects.filter((p) => n(p.residential_prop)).sort((a, b) => (b.open_date ?? '').localeCompare(a.open_date ?? ''))[0];
    const projArea = proj ? n(proj.residential_prop) : null;
    const projDone = proj ? (proj.building_permits ?? '').split(/,\s*/).some((bp) => permits.some((p) => p.permit_number === bp.trim() && isComplete(p))) : false;
    const near = (a: number | null, b: number) => a != null && Math.abs(a - b) / b <= 0.1;
    let row: ClaimRow;
    const projSrc = proj ? S.planning(proj) : null;
    if (projArea && projDone && near(projArea, claims.sqft)) {
      row = { key: 'sqft', title: 'Sq ft', listing: int(claims.sqft), records: int(projArea), label: 'matches_planning',
        why: `Planning approved the ${/adu/i.test(proj!.description ?? '') ? 'ADU ' : ''}project at ${int(projArea)} sq ft of floor area${n(proj!.residential_exist) ? `, up from ${int(n(proj!.residential_exist)!)}` : ''} ${c(projSrc)}.${rollArea ? ` The assessor's ${int(rollArea)} predates the work ${c(rollSrc)}.` : ''}` };
    } else if (projArea && rollArea && !near(rollArea, projArea)) {
      const lo = Math.min(rollArea, projArea), hi = Math.max(rollArea, projArea);
      row = { key: 'sqft', title: 'Sq ft', listing: int(claims.sqft), records: fit14(`${int(lo)} to ${int(hi)}`), label: 'records_disagree',
        why: `The assessor records ${int(rollArea)} sq ft ${c(rollSrc)}. Planning approved ${int(projArea)} sq ft ${c(projSrc)}${projDone ? '' : ', for work that is not signed off'}. Ask for a measured floor plan.` };
    } else if (rollArea && near(rollArea, claims.sqft)) {
      row = { key: 'sqft', title: 'Sq ft', listing: int(claims.sqft), records: int(rollArea), label: 'matches', why: `The assessor records ${int(rollArea)} sq ft ${c(rollSrc)}.` };
    } else if (rollArea) {
      row = { key: 'sqft', title: 'Sq ft', listing: int(claims.sqft), records: int(rollArea), label: 'records_differ',
        why: `The assessor records ${int(rollArea)} sq ft ${c(rollSrc)}. Appraisals can come in below the advertised size, so ask how it was measured.` };
    } else {
      row = { key: 'sqft', title: 'Sq ft', listing: int(claims.sqft), records: null, label: 'not_settled', why: 'No city record gives the floor area.' };
    }
    ledger.push(row);
  }

  // The permit that best describes current work: the costliest live permit, else the latest one.
  const mainPermit = [...permits.filter(isLive)].sort((a, b) => Number(b.revised_cost ?? b.estimated_cost ?? 0) - Number(a.revised_cost ?? a.estimated_cost ?? 0))[0] ?? permits[0] ?? null;

  // In-law
  if (claims.adu) {
    if (unitLegalized && lastUnitPermit) {
      const label: FindingLabel = unitComplaints.length ? 'resolved' : 'matches';
      const yrs = [...new Set(unitComplaints.map((x) => year(x.date_filed)))].filter(Boolean) as number[];
      const yrsText = yrs.length > 2 ? `${yrs.slice(0, -1).join(', ')} and ${yrs[yrs.length - 1]}` : yrs.join(' and ');
      const firstDesc = firstUnitComplaint ? complaintText(firstUnitComplaint) + ' ' + unitComplaints.map(complaintText).join(' ') : '';
      const detail = /ventilation|window|egress/.test(firstDesc) ? ' with no windows or ventilation in the bedroom' : '';
      const novCount = (lastUnitPermit.description ?? '').match(/nov\s*#?\s*\d+/gi)?.length ?? 0;
      ledger.push({
        key: 'adu', title: 'In-law', listing: claims.adu === 'legal' ? 'Legal' : 'In-law', records: `Legal ${year(lastUnitPermit.completed_date)}`, label,
        why: label === 'resolved'
          ? `Complaints in ${yrsText} cited an illegal unit${detail} ${c(S.complaint(firstUnitComplaint!))}. The ${year(lastUnitPermit.filed_date)} permit was filed to comply with ${novCount === 2 ? 'both notices' : novCount > 2 ? 'the notices' : 'the notice'} of violation and is complete ${c(S.permit(lastUnitPermit))}.`
          : `Permit ${lastUnitPermit.permit_number} created the unit and is complete ${c(S.permit(lastUnitPermit))}.`,
      });
    } else if (aduIsSecondUnit && !liveUnit[0]) {
      ledger.push({
        key: 'adu', title: 'In-law', listing: claims.adu === 'legal' ? 'Legal' : /garden/i.test(input.listingText) ? 'Garden in-law' : 'In-law',
        records: 'Legal 2nd unit', label: 'matches',
        why: `City records count two legal units ${c(rollSrc)}. Ask which one the listing calls the in-law.`,
      });
    } else {
      const live = liveUnit[0];
      const closedUnitCase = planning.filter((p) => /ENF/.test(p.record_type ?? p.record_id ?? '') && /^closed/i.test(p.record_status ?? '') && /short-term|unpermitted dwell|udu|illegal unit|unauthori[sz]ed unit/i.test(p.description ?? ''))
        .sort((a, b) => (b.open_date ?? '').localeCompare(a.open_date ?? ''))[0];
      const caseYear = closedUnitCase ? year(closedUnitCase.close_date ?? closedUnitCase.open_date) : null;
      const caseNote = closedUnitCase && P
        ? ` Planning closed a case about ${/short-term/i.test(closedUnitCase.description ?? '') ? 'short-term rentals and a possible unpermitted unit' : 'an unpermitted unit'}${caseYear ? ` in ${caseYear}` : ''} ${c(S.planningParcel(P, caseYear ? String(caseYear) : null))}.`
        : '';
      ledger.push({
        key: 'adu', title: 'In-law', listing: claims.adu === 'legal' ? 'Legal' : /garden/i.test(input.listingText) ? 'Garden in-law' : 'In-law',
        records: live ? 'Not finaled' : 'None', label: live ? 'permitted_not_finaled' : 'no_permit_found',
        why: live ? `Permit ${live.permit_number} would add the unit and is not signed off ${c(S.permit(live))}.`
          : `No permit creates a second unit${mainPermit ? ` ${c(S.permit(mainPermit))}` : ''}.${caseNote}${firstUnitComplaint ? ` A ${year(firstUnitComplaint.date_filed)} complaint described an unpermitted unit ${c(S.complaint(firstUnitComplaint))}.` : ''} Ask whether anyone lives there.`,
      });
    }
  }

  // Bedrooms
  if (claims.beds != null) {
    const bedPermit = permits.find((p) => /bedroom/.test(lower(p.description)) && isComplete(p));
    if (!rollBeds && !bedPermit) {
      // Nothing in the records speaks to bedrooms; a row would only say so.
    } else if (!rollBeds) {
      ledger.push({ key: 'beds', title: 'Bedrooms', listing: String(claims.beds), records: null, label: 'not_settled',
        why: `The assessor leaves bedrooms blank for this parcel.${bedPermit ? ` A ${year(bedPermit.completed_date)} permit ${/office/.test(lower(bedPermit.description)) ? 'converted one upstairs bedroom to an office' : 'changed a bedroom'} ${c(S.permit(bedPermit))}.` : ''} Ask for the floor plan.` });
    } else {
      ledger.push({ key: 'beds', title: 'Bedrooms', listing: String(claims.beds), records: String(rollBeds), label: rollBeds === claims.beds ? 'matches' : 'records_differ',
        why: `The assessor records ${rollBeds} bedroom${rollBeds === 1 ? '' : 's'} ${c(rollSrc)}.` });
    }
  }

  /* ----- cases ----- */
  const cases: CaseRow[] = [];
  const active = complaints.filter((x) => /^active/i.test(x.status ?? '')).sort((a, b) => (b.date_filed ?? '').localeCompare(a.date_filed ?? ''));
  const activeNovs = novs.filter((v) => /^active/i.test(v.status ?? '') && !active.some((a) => a.complaint_number === v.complaint_number));
  const caseFee = active.length || activeNovs.length ? 152 : null;
  // A big complex can have dozens of open complaints: the newest 7 as cards, the rest as one summary card.
  const SHOWN = 7;
  const activeSorted = [...active].sort((a, b) => (b.date_filed ?? '').localeCompare(a.date_filed ?? ''));
  for (const a of activeSorted.slice(0, active.length > SHOWN + 1 ? SHOWN : active.length)) {
    const nov = novs.find((v) => v.complaint_number === a.complaint_number);
    const d = lower(a.complaint_description);
    const title = nov?.unsafe_building === 'Y' ? 'Unsafe building notice' : /over[- ]?excavat/.test(d) ? 'Over-excavation at the rear' : /shoring|excavat/.test(d) ? 'Excavation before a shoring permit'
      : /without (a )?permit|no permit/.test(d) || nov?.work_without_permit === 'Y' ? 'Work without a permit' : (() => {
          const w = shortWhat(a.complaint_description, '');
          const about: Record<string, string> = { reroof: 'roofing work', baths: 'bathroom work', kitchen: 'kitchen work', remodel: 'a remodel', ADU: 'an ADU', 'ADU legalization': 'an ADU',
            foundation: 'foundation work', 'illegal unit': 'an illegal unit', demolition: 'demolition', 'sewer lateral': 'the sewer lateral', excavation: 'excavation', 'bedroom to office': 'a room conversion' };
          return about[w] ? `Complaint about ${about[w]}` : year(a.date_filed) ? `Open complaint from ${year(a.date_filed)}` : 'Open complaint';
        })();
    const flags = [nov?.unsafe_building === 'Y' ? 'as an unsafe building' : '', nov?.work_without_permit === 'Y' ? 'work without a permit' : '', nov?.additional_work_beyond_permit === 'Y' ? 'work beyond the permit' : ''].filter(Boolean);
    cases.push({
      glyph: 'violation', title, label: 'open_case',
      text: `Complaint ${a.complaint_number}, filed ${fmtDate(a.date_filed)}, is active${flags.length ? `, flagged ${flags.join(' and ')}` : ''} ${c(S.complaint(a))}.`,
      stake: `${money(152)} a month in monitoring fees while open ${c(S.dbiFees())}`,
    });
  }
  if (active.length > SHOWN + 1) {
    const rest = activeSorted.slice(SHOWN);
    const oldest = rest[rest.length - 1];
    cases.push({ glyph: 'violation', title: `${rest.length} more open complaints`, label: 'open_case',
      text: `${rest.length} older complaints are also active, the oldest filed ${fmtDate(oldest.date_filed)} ${c(S.complaint(oldest))}. Ask the seller for the full list.`,
      stake: `${money(152)} a month in monitoring fees while open ${c(S.dbiFees())}` });
  }
  const openPlanning = planning.filter((p) => /ENF/.test(p.record_type ?? p.record_id ?? '') && !/^closed/i.test(p.record_status ?? ''));
  for (const p of openPlanning) {
    const aboutUnit = ILLEGAL_UNIT.test(lower(p.description));
    const newerCfc = aboutUnit && unitCfc && day(unitCfc.date_issued) > day(p.open_date);
    cases.push({
      glyph: 'planning', title: `Planning enforcement case still "${lower(p.record_status)}"`, label: newerCfc ? 'likely_stale' : 'open_case',
      text: newerCfc
        ? `Case ${p.record_id}, opened ${fmtDate(p.open_date)}, notes an unauthorized unit. The unit was certified in ${year(unitCfc!.date_issued)}, so this is probably outdated ${c(S.planning(p), S.cfc(unitCfc!))}.`
        : `Case ${p.record_id}, opened ${fmtDate(p.open_date)}, is still open ${c(S.planning(p))}.`,
    });
  }

  // Renovation claim vs open work (only when it does not simply check out)
  if (claims.renovations.length && !multiParcel) {
    const bigLive = permits.filter(isLive).filter((p) => /remodel|renovat|slab|garage|excavat|addition/.test(lower(p.description)));
    if (bigLive.length) {
      const p = bigLive.sort((a, b) => Number(b.estimated_cost ?? 0) - Number(a.estimated_cost ?? 0))[0];
      const label: FindingLabel = active.length ? 'open_case' : 'permitted_not_finaled';
      ledger.unshift({
        key: 'renovation', title: 'Renovated', listing: input.listingText.match(/renovated\s+(20\d\d)/i)?.[1] ?? 'Yes', records: 'Not finaled', label,
        why: `The remodel permit ${p.permit_number}${Number(p.estimated_cost) ? `, valued at ${money(Number(p.revised_cost ?? p.estimated_cost))},` : ''} is issued, not complete ${c(S.permit(p))}.${active.length ? ` ${cap(word(active.length))} complaint${active.length > 1 ? 's are' : ' is'} active ${c(...active.map(S.complaint))}.` : ''}`,
      });
    }
  }
  // Sort ledger by severity so problems come first.
  const sev: Record<FindingLabel, number> = { open_case: 0, no_permit_found: 1, records_differ: 2, permitted_not_finaled: 3, records_disagree: 4, likely_stale: 5, not_settled: 6, permitted_not_updated: 7, resolved: 8, matches_planning: 9, matches: 10 };
  for (const r of ledger) { if (r.records) r.records = fit14(r.records); if (r.listing) r.listing = fit14(r.listing); r.why = r.why.replace(/ +([.,;:])/g, '$1'); }
  if (ledger.some((r) => sev[r.label] <= 3)) ledger.sort((a, b) => sev[a.label] - sev[b.label]);

  /* ----- systems ----- */
  // Permit tags from the permit reader (Claude, or the same regexes offline) widen what each system row finds.
  const tag = (p: Row, k: 'rewire' | 'sewerLateral' | 'foundation' | 'reroof') => !!raw.permitFacts?.get(p.permit_number ?? '')?.[k];
  const systems: SystemRow[] = [];
  const builtText = yearBuilt ? `Built ${yearBuilt}, so ask the inspector to look at it.` : 'Ask the inspector to look at it.';
  // An issued permit more than 3 years old that never got its final is not "in progress": it was never signed off.
  const stale = (p: Row) => !isComplete(p) && (year(p.issued_date ?? p.filed_date) ?? 9999) < input.now.getUTCFullYear() - 3;
  const sysStatus = (p: Row): SystemRow['status'] => (isComplete(p) ? ((year(p.completed_date) ?? 0) < input.now.getUTCFullYear() - 30 ? 'old' : 'updated') : stale(p) && (year(p.issued_date ?? p.filed_date) ?? 9999) < input.now.getUTCFullYear() - 30 ? 'old' : 'in_progress');
  {
    const bathSrcs = finaledBaths.map((x) => x.p);
    const plumb = bathSrcs.length ? bathSrcs : plumbing.filter((p) => /^PP/i.test(p.permit_number ?? '')).sort((a, b) => (b.completed_date ?? b.issued_date ?? '').localeCompare(a.completed_date ?? a.issued_date ?? '')).slice(0, 1);
    if (plumb.length) {
      const p0 = plumb[0];
      const st = plumb.every(isComplete) ? sysStatus(p0) : 'in_progress';
      const d = lower(plumb.map((p) => p.description).join(' '));
      const what = /galvani|main stack|repipe/.test(d) ? 'Galvanized pipes and main stack being replaced' : plumb.length > 1 && /adu/.test(d) ? 'Both units replumbed for new baths and kitchens' : /bath/.test(d) ? 'Plumbing for new baths' : 'Plumbing work';
      systems.push({ glyph: 'plumbing', title: 'Plumbing', year: year(p0.completed_date ?? p0.issued_date ?? p0.filed_date), status: st,
        text: st === 'in_progress' ? `${what}, permit issued, not final ${c(...plumb.map((p) => S.plumbing(p)))}` : `${what}, final ${fmtDate(plumb.map((p) => p.completed_date).sort().pop())} ${c(...plumb.map((p) => S.plumbing(p, /adu/i.test(p.description ?? '') ? 'ADU baths' : /2\/f|2nd|upstairs/i.test(p.description ?? '') ? 'upstairs baths' : undefined)))}` });
    } else systems.push({ glyph: 'plumbing', title: 'Plumbing', year: null, status: 'no_record', text: `No plumbing permit on record. ${builtText}` });
  }
  {
    const roofs = permits.filter((p) => (/re-?roof|roofing/.test(lower(p.description)) || tag(p, 'reroof')) && (isComplete(p) || isLive(p)));
    const r = roofs.filter(isComplete).sort((a, b) => (b.completed_date ?? '').localeCompare(a.completed_date ?? ''))[0] ?? roofs[0];
    if (r) {
      const st = sysStatus(r);
      systems.push({ glyph: 'roof', title: 'Roof', year: year(r.completed_date ?? r.issued_date), status: st,
        text: stale(r) ? `Reroof permit issued ${year(r.issued_date ?? r.filed_date)}, never signed off ${c(S.permit(r))}. Ask whether the work was done.` : st === 'in_progress' ? `Reroof permit issued, not complete ${c(S.permit(r))}` : `Reroofed, permit complete ${fmtDate(r.completed_date)} ${c(S.permit(r))}` });
    } else systems.push({ glyph: 'roof', title: 'Roof', year: null, status: 'no_record', text: `No roof permit on record. ${builtText}` });
  }
  {
    const el = [...electrical].sort((a, b) => (b.completed_date ?? b.issued_date ?? '').localeCompare(a.completed_date ?? a.issued_date ?? ''));
    if (el.length && P) {
      const e0 = el[0];
      const st = isComplete(e0) ? sysStatus(e0) : 'in_progress';
      const yr = year(e0.completed_date ?? e0.issued_date ?? e0.filed_date);
      const d = lower(el.slice(0, 3).map((e) => e.description).join(' '));
      const what = /knob/.test(d) ? 'Knob-and-tube wiring being replaced' : /service|panel|200 ?a/.test(d) ? 'Panel or service upgraded' : `Electrical permits filed with the ${year(e0.filed_date ?? e0.issued_date) ?? ''} remodel`.replace(' the  remodel', ' the remodel');
      systems.push({ glyph: 'electrical', title: 'Wiring', year: yr, status: st,
        text: st === 'in_progress' ? `${what}, permit issued, not final ${c(S.electrical(P, yr ? String(yr) : null))}` : `${what}, complete ${c(S.electrical(P, yr ? String(yr) : null))}` });
    } else systems.push({ glyph: 'electrical', title: 'Wiring', year: null, status: 'no_record', text: `No electrical permit on record. ${builtText}` });
  }
  {
    const f = permits.find((p) => (/foundation|seismic|retrofit|grade beam|underpin/.test(lower(p.description)) || tag(p, 'foundation')) && (isComplete(p) || isLive(p)));
    if (f) {
      const st = sysStatus(f);
      systems.push({ glyph: 'foundation', title: 'Foundation', year: year(f.completed_date ?? f.issued_date), status: st,
        text: st === 'in_progress' ? `Foundation work permitted, not complete${active.length ? ', under the open complaints' : ''} ${c(S.permit(f), ...(active.length ? active.map(S.complaint) : []))}` : `Foundation work complete ${fmtDate(f.completed_date)} ${c(S.permit(f))}` });
    } else systems.push({ glyph: 'foundation', title: 'Foundation', year: null, status: 'no_record', text: `No permit on record. ${builtText}` });
  }
  {
    const s = [...permits, ...plumbing].find((p) => (/sewer lateral|side sewer|lateral/.test(lower(p.description)) || tag(p, 'sewerLateral')) && (isComplete(p) || isLive(p)));
    if (s) {
      const isPlumb = /^P/i.test(s.permit_number ?? '');
      systems.push({ glyph: 'plumbing', title: 'Sewer lateral', year: year(s.completed_date ?? s.issued_date), status: sysStatus(s), text: `Sewer lateral work on record ${c(isPlumb ? S.plumbing(s) : S.permit(s))}` });
    } else systems.push({ glyph: 'plumbing', title: 'Sewer lateral', year: null, status: 'no_record', text: `No permit on record. A camera inspection costs a few hundred dollars and is worth it${yearBuilt ? ` for a ${yearBuilt} house` : ''}.` });
  }

  /* ----- tenants ----- */
  const tenants: InfoRow[] = [];
  const buyouts = raw.buyouts ?? [];
  const hotel = raw.hotelTax ?? [];
  const addrUpper = `${Number(addr.input.number)} ${addr.streetName}%`;
  const slug = `${Number(addr.input.number)}-${addr.streetName.toLowerCase().replace(/\s+/g, '-')}`;
  for (const b of buyouts.slice(0, 3)) {
    const amt = n(b.buyout_amount);
    const t = n(b.number_of_tenants);
    tenants.push({ glyph: 'tenants', title: `Tenant buyout in ${year(b.buyout_agreement_date ?? b.pre_buyout_disclosure_declaration_date)}`,
      text: `Buyout ${b.case_number}, filed ${fmtDate(b.buyout_agreement_date ?? b.pre_buyout_disclosure_declaration_date)}: ${amt ? money(amt) + ' paid' : 'paid'} to ${t ?? 'the'} tenant${t === 1 ? '' : 's'} to leave ${c(S.buyout(b, addr.display, addrUpper))}. ${multiParcel ? 'This was filed for the building. Ask the Rent Board whether it involved this unit.' : 'A past buyout can limit converting the units to condos later. Ask the Rent Board how it applies.'}` });
  }
  const hotelStart = hotel.map((h) => h.location_start_date).filter(Boolean).sort()[0] ?? null;
  const hotelSrc = hotel.length ? S.hotelTax(slug, addr.display, day(hotelStart) || null) : null;
  if (hotel.length) {
    tenants.push({ glyph: 'money', title: 'Short-term rental signal',
      text: `A business at this address has been registered for hotel tax since ${fmtDate(hotelStart)} ${c(hotelSrc)}. That usually means short-term rentals. Ask whether any bookings run past closing.` });
  }
  const unitsNow = recordUnits ?? rollUnits ?? 1;
  const preRentControl = yearBuilt != null && yearBuilt < 1979;
  if (unitsNow >= 2 && preRentControl) {
    tenants.push({ glyph: 'tenants', title: 'Rent control', text: `${cap(word(unitsNow))} units in a building from ${yearBuilt}. Units like these are usually covered by eviction protections, and often by rent limits. Confirm with the Rent Board before you plan to move in or rent out.` });
  } else if (unitsNow >= 2) {
    tenants.push({ glyph: 'tenants', title: 'Rent control', text: `${cap(word(unitsNow))} units${yearBuilt ? ` in a building from ${yearBuilt}` : ''}. Eviction protections can still apply. Confirm with the Rent Board.` });
  } else {
    tenants.push({ glyph: 'tenants', title: 'Rent control', text: `One legal unit. A rented ${/garden (?:in-?law|unit|cottage)/i.test(input.listingText) ? 'garden' : 'in-law'} unit, permitted or not, can bring eviction protections with it. Confirm with the Rent Board.` });
  }
  if (firstUnitComplaint && unitsNow >= 2) {
    tenants.push({ glyph: 'complaint', title: 'Tenants now', text: `Not in public records. The ${year(firstUnitComplaint.date_filed)} complaint described a renter in the ${/garage/.test(complaintText(firstUnitComplaint)) ? 'garage ' : ''}unit ${c(S.complaint(firstUnitComplaint))}. Ask whether either unit is occupied.` });
  } else if (!buyouts.length && !hotel.length) {
    tenants.push({ glyph: 'resolved', title: 'No buyouts or hotel-tax registrations', text: `No tenant buyout on file for this address ${c(S.noBuyout(pid))}.`, muted: true });
  }

  /* ----- upside ----- */
  const upside: InfoRow[] = [];
  if (zoning) {
    const z = zoning.toUpperCase();
    const desc = /^RH-1/.test(z) ? `Residential, one-family district.${unitLegalized ? ' The legalized ADU is the second unit.' : ' An ADU can usually be added with a permit.'}`
      : /^RH-2/.test(z) ? 'Residential, two-family district. A second unit is allowed in principle, with its own permit.'
      : /^RH-3/.test(z) ? 'Residential, three-family district.' : /^RM/.test(z) ? 'Residential, mixed apartments.' : /^NC/.test(z) ? 'Neighborhood commercial district.' : 'See the Planning Code for what this district allows.';
    upside.push({ glyph: 'zoning', title: `Zoning ${zoning}`, text: desc });
  }
  const sb9 = !!zoning && /^RH-1/.test(zoning) && lotSqft != null && lotSqft >= 2400 && !historic;
  if (lotSqft && (!zoning || /^RH-1/.test(zoning))) { // SB 9 only applies in one-family districts
    upside.push({ glyph: 'grow', title: `Lot ${int(lotSqft)} sq ft`,
      text: sb9 ? `Above the 2,400 sq ft minimum for an SB 9 lot split. SB 9 is off the table if a unit was rented in the last 3 years ${c(rollSrc)}.`
        : lotSqft >= 2400 ? `Large enough for an SB 9 split only in a one-family district ${c(rollSrc)}.` : `Below the 2,400 sq ft minimum for an SB 9 lot split ${c(rollSrc)}.` });
  }
  if (historic) {
    upside.push({ glyph: 'planning', title: 'Historic district', text: `In the ${historic.name_1?.replace(/ Historic District$/i, '')} landmark district, so exterior changes go through historic review ${c(S.historic(pid, historic.name_1 ?? 'district'))}.` });
  }

  /* ----- hazards ----- */
  const hz = raw.hazards as Hazards | undefined;
  const hazards: HazardCheck[] = [];
  if (hz) {
    const hs = S.hazards(pid);
    const flood = hz.femaZone;
    const floodNote = !!flood && /^(A|V)/.test(flood);
    hazards.push(flood == null ? { key: 'flood', title: 'Flood', status: 'unknown', text: 'FEMA flood map did not answer' }
      : { key: 'flood', title: 'Flood', status: floodNote ? 'note' : 'clear', text: floodNote ? `FEMA zone ${flood}, a high-risk flood area ${c(hs)}. Lenders require flood insurance.` : `FEMA zone ${flood}, minimal flood hazard ${c(hs)}` });
    hazards.push(hz.stormFlood == null ? { key: 'storm_flood', title: 'Storm flooding', status: 'unknown', text: 'The storm flood map did not answer' }
      : { key: 'storm_flood', title: 'Storm flooding', status: hz.stormFlood ? 'note' : 'clear', text: hz.stormFlood ? `Inside the city's 100-year storm flood zone ${c(S.stormflood(pid))}. Sellers must disclose it.` : `Outside the city's 100-year storm flood zone ${c(S.stormflood(pid))}` });
    hazards.push(hz.liquefaction == null ? { key: 'liquefaction', title: 'Liquefaction', status: 'unknown', text: 'The state liquefaction map did not answer' }
      : { key: 'liquefaction', title: 'Liquefaction', status: hz.liquefaction ? 'note' : 'clear', text: hz.liquefaction ? `Inside a state liquefaction zone ${c(hs)}. Ask about the foundation.` : `Outside the state liquefaction zone ${c(hs)}` });
    if (hz.landslideZone) hazards.push({ key: 'landslide', title: 'Landslide', status: 'note', text: `Inside a state landslide zone ${c(hs)}${hz.landslideClass ? `, susceptibility class ${hz.landslideClass} of 10 ${c(S.landslide(pid))}` : ''}. Worth raising with the inspector.` });
    else if ((hz.landslideClass ?? 0) >= 7) hazards.push({ key: 'landslide', title: 'Landslide', status: 'note', text: `Susceptibility class ${hz.landslideClass} on the city's landslide map, where 10 is highest ${c(S.landslide(pid))}. Worth raising with a structural engineer.` });
    else hazards.push({ key: 'landslide', title: 'Landslide', status: hz.landslideZone == null ? 'unknown' : 'clear', text: hz.landslideZone == null ? 'The state landslide map did not answer' : `Outside the state landslide zone ${c(hs)}` });
    hazards.push(hz.tsunami == null ? { key: 'tsunami', title: 'Tsunami', status: 'unknown', text: 'The tsunami map did not answer' }
      : { key: 'tsunami', title: 'Tsunami', status: hz.tsunami ? 'note' : 'clear', text: hz.tsunami ? `Inside the tsunami hazard area ${c(hs)}` : `Outside the tsunami hazard area ${c(hs)}` });
    hazards.push(hz.seaLevel == null ? { key: 'sea_level', title: 'Sea level rise', status: 'unknown', text: 'The sea level rise map did not answer' }
      : { key: 'sea_level', title: 'Sea level rise', status: hz.seaLevel ? 'note' : 'clear', text: hz.seaLevel ? `Inside the sea level rise maps ${c(S.sealevel(pid))}` : `Outside the sea level rise maps, even with 66 inches of rise ${c(S.sealevel(pid))}` });
    const res = hz.reservoirs;
    hazards.push(res == null ? { key: 'reservoir', title: 'Reservoir', status: 'unknown', text: 'The reservoir map did not answer' }
      : res.length ? { key: 'reservoir', title: 'Reservoir', status: 'note', text: `Inside the ${res.join(' and ')} reservoir${res.length > 1 ? 's' : ''}' failure zone${res.length > 1 ? 's' : ''} ${c(S.reservoir(pid))}. Ask your insurer whether it changes the quote.` }
      : { key: 'reservoir', title: 'Reservoir', status: 'clear', text: `Outside every reservoir failure zone ${c(S.reservoir(pid))}` });
    hazards.push(hz.maher == null ? { key: 'soil', title: 'Soil', status: 'unknown', text: 'The Maher soil map did not answer' }
      : { key: 'soil', title: 'Soil', status: hz.maher ? 'note' : 'clear', text: hz.maher ? `Inside the Maher soil testing area ${c(S.maher(pid))}. Digging needs soil testing.` : `Outside the Maher soil testing area ${c(S.maher(pid))}` });
  }

  /* ----- nearby ----- */
  const nearby: InfoRow[] = [];
  for (const p of (raw.nearbyProjects ?? [])
    .filter((p) => p.demolition === 'CHECKED' || p.new_construction === 'CHECKED' || Math.abs(n(p.number_of_units_net) ?? 0) >= 1)
    .filter((p) => !/cancel|withdraw|disapprov|expired/i.test(p.record_status ?? ''))
    .sort((a, b) => (b.open_date ?? '').localeCompare(a.open_date ?? '')).slice(0, 4)) {
    const units = n(p.number_of_units_prop);
    const d = lower(p.description);
    const stories = d.match(/(\w+)-story/)?.[1];
    const storiesN = stories ? (WORDNUM[stories] ?? (stories === 'three' ? 3 : Number(stories))) : null;
    const what = p.demolition === 'CHECKED' && p.new_construction === 'CHECKED'
      ? `Full demolition and a new ${storiesN ? storiesN + '-story, ' : ''}${units ? units + '-unit ' : ''}building`
      : p.new_construction === 'CHECKED' ? `A new ${units ? units + '-unit ' : ''}building` : p.adu === 'CHECKED' ? 'A new in-law unit'
      : (n(p.number_of_units_net) ?? 0) > 0 ? `${cap(word(n(p.number_of_units_net)!))} unit${n(p.number_of_units_net) === 1 ? '' : 's'} added` : `${cap(word(Math.abs(n(p.number_of_units_net)!)))} unit${n(p.number_of_units_net) === -1 ? '' : 's'} removed`;
    const st = lower(p.record_status);
    const status = st.startsWith('submit') ? 'submitted' : /approv/.test(st) ? 'approved, filed' : /review|open|pending|accepted/.test(st) ? 'under review, filed' : /complete|closed/.test(st) ? 'closed, filed' : 'filed';
    // The city writes "0 P UNKNOWN" when a project has no street address.
    const where = (p.project_address ?? '').replace(/\s+\d{5}$/, '');
    nearby.push({ glyph: 'nearby', title: !where || /unknown/i.test(where) ? 'Planning project nearby' : titleCase(where), // never project_name: it can name a person
      text: `${what}. Project ${p.record_id} was ${status} ${fmtDate(p.open_date)}, within 150 m ${c(S.planning(p))}.` });
  }

  const street = (raw.streetPermits ?? []).filter((p) => /street space/i.test(p.permit_type ?? 'street space'));
  if (street.length) {
    const end = street.map((p) => p.permit_end_date).filter(Boolean).sort().pop();
    nearby.push({ glyph: 'nearby', title: 'Street-space permit',
      text: `${street.length === 1 ? 'A street-space permit' : `${cap(word(street.length))} street-space permits`} on this frontage ${street.length === 1 ? 'runs' : 'run'} to ${fmtDate(end)}, for construction staging ${c(S.street(pid, addr.display))}.` });
  }

  /* ----- money (A7) ----- */
  const assessed = roll ? Math.round((n(roll.assessed_land_value) ?? 0) + (n(roll.assessed_improvement_value) ?? 0) + (n(roll.assessed_fixtures_value) ?? 0)) || null : null;
  const price = claims.price ?? assessed ?? 0;
  const inputs: MoneyInputs = {
    assessedValue: assessed, ownerOccupied: true, melloRoosPerSqft: null, sqft: null, openCaseMonthlyFee: caseFee,
    sourceIndex: { taxRate: cites.n(S.taxRate()), supplemental: cites.n(S.supplemental()), transferTax: cites.n(S.transfer()), ...(caseFee ? { caseFees: cites.n(S.dbiFees()) } : {}) },
  };
  const rows: CostRow[] = computeCosts(price, inputs, input.closing);

  /* ----- unknowns and decision (A8) ----- */
  const unknowns: Unknown[] = [];
  const staleCase = cases.find((x) => x.label === 'likely_stale');
  const openPlan = openPlanning[0];
  const structural = active.filter((a) => /excavat|shoring|foundation|structural|retaining|collapse|crack/.test(lower(a.complaint_description)));
  if (structural.length) unknowns.push({ id: 'u-excavation', title: /excavat|shoring/.test(lower(structural[0].complaint_description)) ? 'Is the excavation sound?' : 'Is the structure sound?',
    why: `${cap(word(structural.length))} active complaint${structural.length > 1 ? 's' : ''} about ${/excavat|shoring/.test(lower(structural[0].complaint_description)) ? 'digging along the property line' : 'the structure'} ${c(...structural.map(S.complaint))}. Only a site visit answers this.`,
    resolver: 'specialist', action: 'book_specialist', specialist: 'structural engineer' });
  if (active.length) unknowns.push({ id: 'u-close-cases', title: 'Will the complaints and permits close before you do?', why: `An open case passes to the next owner, and so do its fees ${c(S.dbiFees())}.`, resolver: 'listing_agent', action: 'email_listing_agent' });
  if (openPlan) unknowns.push({ id: 'u-planning-case', title: 'Is the Planning case closed?', why: `Case ${openPlan.record_id} still reads "${lower(openPlan.record_status)}". A clean close-out protects resale ${c(S.planning(openPlan))}.`, resolver: 'city', action: 'email_city' });
  const aduRow = ledger.find((r) => r.key === 'adu');
  if (aduRow && aduRow.label === 'no_permit_found') unknowns.push({ id: 'u-garden-unit', title: `What is the ${/garden (?:in-?law|unit|cottage)/i.test(input.listingText) ? 'garden in-law' : 'in-law'}, legally?`, why: aduRow.why.split('. ').slice(0, 1).join('') + '. Ask whether anyone lives there.', resolver: 'listing_agent', action: 'email_listing_agent' });
  if (unitsNow >= 2) unknowns.push({ id: 'u-tenants', title: multiParcel ? 'Is the unit rented?' : unitsNow === 2 ? 'Is either unit rented?' : 'Are any units rented?', why: 'A tenant changes when you can move in and what you can charge.', resolver: 'listing_agent', action: 'email_listing_agent' });
  if (hotel.length) unknowns.push({ id: 'u-short-term', title: 'Are short-term rentals booked?', why: `A hotel-tax registration has been active since ${year(hotelStart)} ${c(hotelSrc)}. Bookings past closing become your problem.`, resolver: 'listing_agent', action: 'email_listing_agent' });
  const bedsRow = ledger.find((r) => r.key === 'beds');
  if (bedsRow?.label === 'not_settled') {
    const bp = permits.find((p) => /bedroom/.test(lower(p.description)) && isComplete(p));
    unknowns.push({ id: 'u-bedrooms', title: 'How many bedrooms are there now?', why: `Records leave bedrooms blank${bp ? ` and one was turned into an office ${c(S.permit(bp))}` : ''}.`, resolver: 'listing_agent', action: 'email_listing_agent' });
  }

  // Caution when the records contradict what the listing sells: open cases, missing permits, or a different unit,
  // bath or in-law count. A size difference alone stays a question for the inspector.
  const bad = ledger.filter((r) => ['open_case', 'no_permit_found'].includes(r.label) || (r.label === 'records_differ' && ['units', 'baths', 'adu'].includes(r.key))).length
    + cases.filter((x) => x.label === 'open_case').length
    + (!multiParcel && unitsNow <= 0 && (listingUnits ?? 0) >= 1 ? 1 : 0); // sold as a home, no housing unit on record
  const unsafe = novs.some((v) => v.unsafe_building === 'Y' && /^active/i.test(v.status ?? ''));
  // A clean result is only a clean result when the core records were read: no "Looks solid" without permits or complaints.
  const unread = (['permits', 'complaints'] as const).filter((k) => failed.has(k));
  const tone: Decision['tone'] = unsafe ? 'stop' : bad || unread.length ? 'caution' : 'clear';
  const noFoundation = systems.find((s) => s.title === 'Foundation')?.status === 'no_record';
  const noLateral = systems.find((s) => s.title === 'Sewer lateral')?.status === 'no_record';
  const extra = noFoundation && noLateral ? ' Ask the inspector to look at the foundation and sewer lateral too.' : noFoundation ? ' Ask the inspector to look at the foundation too.' : noLateral ? ' Ask for a sewer lateral camera inspection too.' : '';
  const decision: Decision = {
    tone,
    title: tone === 'clear' ? 'Looks solid' : tone === 'caution' ? (!bad && unread.length ? 'Check again before you offer' : 'Get it checked before you offer') : 'Stop and ask first',
    inspection: '',
  };
  decision.inspection = structural.length
      ? `Have a structural engineer look at the ${structural.some((a) => /excavat|shoring/.test(lower(a.complaint_description))) ? 'excavation and foundation' : 'foundation and structure'} before you offer, then a standard inspection.`
      : tone === 'clear' ? `A standard inspection${multiParcel ? ' of the unit' : unitsNow === 2 ? ' covering both units' : unitsNow >= 3 && unitsNow <= 4 ? ` covering all ${word(unitsNow)} units` : ''} is enough.${extra}`
      : !bad && unread.length ? `City ${unread.map((k) => (k === 'permits' ? 'permits' : 'complaints')).join(' and ')} couldn't be read this time. Run the check again before you offer, then get a standard inspection.${extra}`
      : `Get a standard inspection before you offer, and ask about the open items below.${extra}`;

  /* ----- glance ----- */
  const unitsRow = ledger.find((r) => r.key === 'units');
  const unitTone: Tone = aduRow?.label === 'no_permit_found' ? 'error' : unitsRow ? LABELS[unitsRow.label].tone : 'neutral';
  // A summary card ("25 more open complaints") stands for that many cases.
  const openCount = cases.reduce((n, x) => n + (Number(x.title.match(/^(\d+) more open complaints$/)?.[1]) || 1), 0);
  const notes = hazards.filter((h) => h.status === 'note');
  const firstNote = notes[0];
  const hazardStatus = !firstNote ? (hazards.length ? 'All clear' : 'Not checked')
    : firstNote.key === 'reservoir' ? 'Reservoir zone' : firstNote.key === 'landslide' ? (hz?.landslideClass ? `Landslide class ${hz.landslideClass}` : 'Landslide zone')
    : firstNote.key === 'flood' ? 'Flood zone' : firstNote.key === 'storm_flood' ? 'Storm flood zone' : firstNote.key === 'liquefaction' ? 'Liquefaction zone' : firstNote.key === 'tsunami' ? 'Tsunami zone' : firstNote.key === 'sea_level' ? 'Sea level rise' : 'Soil testing area';
  const glance: GlanceTile[] = [
    multiParcel ? { section: 'ledger', glyph: 'parcel', label: 'Condo unit', value: '1', tone: unitTone, status: unitsNow >= 2 ? `In a ${unitsNow}-unit building` : 'Own parcel' } :
    { section: 'ledger', glyph: 'parcel', label: 'Legal units', value: String(unitsNow), tone: unitTone,
      status: aduRow?.label === 'no_permit_found' ? 'In-law not permitted' : !unitsRow ? 'Listing is silent' : ['matches', 'permitted_not_updated', 'resolved', 'matches_planning'].includes(unitsRow.label) ? 'Matches listing' : LABELS[unitsRow.label].text },
    { section: 'cases', glyph: active.length ? 'violation' : 'planning', label: 'Open city cases', value: String(openCount),
      tone: !openCount ? 'success' : cases.every((x) => x.label === 'likely_stale') ? 'warning' : 'error',
      status: !openCount ? 'None open' : cases.every((x) => x.label === 'likely_stale') ? 'Probably outdated' : active.length ? 'Active complaints' : 'Open case' },
    { section: 'costs', glyph: 'money', label: 'Property tax', value: null, tone: 'neutral', status: claims.price ? 'A month at asking' : 'A month at assessed value' },
    buyouts.length
      ? { section: 'tenants', glyph: 'tenants', label: 'Tenants', value: `Buyout ${year(buyouts[0].buyout_agreement_date ?? buyouts[0].pre_buyout_disclosure_declaration_date)}`, tone: 'warning', status: unitsNow >= 2 && preRentControl ? 'Rent rules likely' : 'Past buyout' }
      : hotel.length ? { section: 'tenants', glyph: 'tenants', label: 'Tenants', value: 'Short-term', tone: 'warning', status: 'Hotel-tax registration' }
      : { section: 'tenants', glyph: 'tenants', label: 'Tenants', value: 'None found', tone: 'success', status: 'No buyouts on file' },
    { section: 'hazards', glyph: firstNote?.key === 'reservoir' ? 'reservoir' : firstNote?.key === 'landslide' ? 'landslide' : /flood/.test(firstNote?.key ?? '') ? 'flood' : 'hazard', label: 'Hazards',
      value: hazards.length ? `${notes.length} of ${hazards.length}` : null, tone: !hazards.length ? 'neutral' : notes.length ? 'warning' : 'success', status: hazardStatus },
    sb9 ? { section: 'upside', glyph: 'grow', label: 'Room to grow', value: 'Lot split', tone: 'info', status: 'Check SB 9 rules' }
      : { section: 'upside', glyph: 'zoning', label: 'Room to grow', value: zoning, tone: 'info', status: historic ? 'Historic district' : zoning && /^RH-[23]|^RM/.test(zoning) ? 'More units allowed' : 'Zoning' },
  ];

  // A source that could not be read never shows as a clean result on the tiles.
  const notChecked = (i: number) => { glance[i] = { ...glance[i], value: null, tone: 'neutral', status: 'Not checked' }; };
  if (failed.has('complaints')) notChecked(1);
  if (failed.has('tenants')) notChecked(3);
  if (failed.has('hazards') || !hazards.length) notChecked(4);
  if (failed.has('permits') && !multiParcel) { glance[0] = { ...glance[0], tone: 'neutral', status: 'Permits not checked' }; }

  /* ----- highlights ----- */
  const good: string[] = [];
  const watch: string[] = [];
  if (unitLegalized && lastUnitPermit) good.push(`In-law legalized and signed off in ${year(lastUnitPermit.completed_date)} ${c(S.permit(lastUnitPermit), unitCfc ? S.cfc(unitCfc) : null)}`);
  const bathsRow = ledger.find((r) => r.key === 'baths');
  if (bathsRow && ['permitted_not_updated', 'matches'].includes(bathsRow.label) && finaledBaths.length) good.push(`${cap(word(Number(bathsRow.records)))} baths have plumbing finals ${c(...finaledBaths.map((x) => S.plumbing(x.p)))}`);
  const roofSys = systems.find((s) => s.title === 'Roof');
  if (roofSys?.status === 'updated' && roofSys.year && roofSys.year >= input.now.getUTCFullYear() - 5) good.push(`New roof in ${roofSys.year} ${roofSys.text.match(/\[\d+\]/)?.[0] ?? ''}`.trim());
  {
    // Work in progress that is permitted is good news: "Plumbing, wiring and foundation work all have permits".
    const live = systems.filter((x) => x.status === 'in_progress' && ['Plumbing', 'Wiring', 'Foundation'].includes(x.title) && /\[\d+\]/.test(x.text));
    if (live.length >= 2) {
      const names = live.map((x) => lower(x.title));
      const refs = [...new Set(live.map((x) => x.text.match(/\[\d+\]/)![0]))].join('');
      good.push(`${cap(names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(' and '))} work ${names.length > 2 ? 'all have' : 'both have'} permits ${refs}`);
    }
  }
  if (hz?.femaZone && !/^(A|V)/.test(hz.femaZone)) good.push(`Outside FEMA flood zones ${c(S.hazards(pid))}`);
  if (!cases.length && !failed.has('complaints')) good.push('No open complaints or city cases');
  if (!buyouts.length && !failed.has('tenants')) good.push(`No tenant buyouts on file ${c(S.noBuyout(pid))}`.replace(` ${c(S.noBuyout(pid))}`, cites.has(`buyout:${pid}`) ? ` ${c(S.noBuyout(pid))}` : ''));
  if (roofSys?.status === 'updated' && roofSys.year && roofSys.year < input.now.getUTCFullYear() - 5) good.push(`Roof replaced in ${roofSys.year} ${roofSys.text.match(/\[\d+\]/)?.[0] ?? ''}`.trim());
  {
    // Several open complaints about the same thing read as one line: "Two active complaints about excavation [3][4]".
    const ref1 = (t: string) => t.match(/\[\d+\]/)?.[0] ?? '';
    const open = cases.filter((x) => x.label === 'open_case');
    const topic = (x: CaseRow) => /excavat/i.test(`${x.title} ${x.text}`) ? 'excavation' : shortWhat(`${x.title} ${x.text}`, '');
    const groups = new Map<string, CaseRow[]>();
    for (const x of open) { const t = topic(x); if (t) groups.set(t, [...(groups.get(t) ?? []), x]); }
    const grouped = new Set<CaseRow>();
    const summary = cases.find((x) => / more open complaints$/.test(x.title));
    if (summary) { // dozens of complaints: one line with the total
      const complaintCards = open.filter((x) => x.glyph === 'violation');
      complaintCards.forEach((x) => grouped.add(x));
      watch.push(`${active.length} open complaints ${complaintCards.slice(0, 3).map((x) => ref1(x.text)).join('')}`.trim());
    }
    for (const [t, xs0] of groups) { const xs = xs0.filter((x) => !grouped.has(x)); if (xs.length < 2) continue; xs.forEach((x) => grouped.add(x)); watch.push(`${cap(word(xs.length))} active complaints about ${t} ${xs.slice(0, 3).map((x) => ref1(x.text)).join('')}`.trim()); }
    // The rest with the same title ("Open complaint" five times) also read as one line.
    const byTitle = new Map<string, CaseRow[]>();
    for (const x of open) if (!grouped.has(x)) byTitle.set(x.title, [...(byTitle.get(x.title) ?? []), x]);
    for (const [title, xs] of byTitle) if (xs.length >= 2) { xs.forEach((x) => grouped.add(x)); watch.push(`${cap(word(xs.length))} ${lower(title).replace(/complaint$/, 'complaints')} ${xs.slice(0, 3).map((x) => ref1(x.text)).join('')}`.trim()); }
    for (const x of cases) if (!grouped.has(x)) watch.push(x.label === 'likely_stale' ? `Planning case still reads ${lower(openPlanning[0]?.record_status)} ${ref1(x.text)}`.trim() : `${x.title} ${ref1(x.text)}`.trim());
  }
  if (aduRow?.label === 'no_permit_found') watch.push(`No permit for the ${/garden (?:in-?law|unit|cottage)/i.test(input.listingText) ? 'garden in-law' : 'in-law unit'} ${aduRow.why.match(/\[\d+\]/)?.[0] ?? ''}`.trim());
  if (caseFee) {
    const one = active.length + activeNovs.length === 1;
    watch.push(`${one ? 'The open complaint' : 'Open complaints'}${multiParcel ? ' at the building' : ''} ${one ? 'costs' : 'cost'} ${money(caseFee)} a month in fees ${c(S.dbiFees())}`);
  }
  for (const r of ledger.filter((r) => r.label === 'permitted_not_finaled')) watch.push(`${r.title} permitted, not signed off ${r.why.match(/\[\d+\]/)?.[0] ?? ''}`.trim());
  for (const b of buyouts.slice(0, 1)) {
    const amt = n(b.buyout_amount); const t = n(b.number_of_tenants);
    const who = t ? `${t} tenant${t === 1 ? '' : 's'}` : 'tenants';
    watch.push(`Tenant buyout in ${year(b.buyout_agreement_date ?? b.pre_buyout_disclosure_declaration_date)}${multiParcel ? ' in the building' : ''}${amt ? `: ${money(amt)} to ${who}` : t ? ` with ${who}` : ''} ${c(S.buyout(b, addr.display, addrUpper))}`);
  }
  if (hotel.length) watch.push(`Hotel-tax registration since ${year(hotelStart)}, a sign of short-term rentals ${c(hotelSrc)}`);
  for (const h of notes) watch.push(h.key === 'reservoir' ? `Inside the ${hz?.reservoirs?.length === 2 && hz.reservoirs.every((r) => /^Sunset/.test(r)) ? 'Sunset' : (hz?.reservoirs ?? []).join(' and ')} reservoirs failure zone ${h.text.match(/\[\d+\]/)?.[0] ?? ''}`.trim()
    : h.key === 'landslide' ? (hz?.landslideZone ? `Inside a state landslide zone ${h.text.match(/\[\d+\]/)?.[0] ?? ''}`.trim() : `Landslide susceptibility class ${hz?.landslideClass} of 10 ${h.text.match(/\[\d+\]/)?.[0] ?? ''}`.trim())
    : `${({ flood: 'Inside a FEMA flood zone', storm_flood: 'Inside the 100-year storm flood zone', liquefaction: 'Inside a state liquefaction zone', tsunami: 'Inside the tsunami hazard area', sea_level: 'Inside the sea level rise maps', soil: 'Inside the Maher soil testing area' } as Record<string, string>)[h.key] ?? h.title} ${h.text.match(/\[\d+\]/)?.[0] ?? ''}`.trim());
  if (nearby.length) {
    const first = nearby[0].text;
    watch.push(/demolition/i.test(first) ? `A demolition and new ${first.match(/(\d+)-unit/)?.[1] ?? ''}-unit building planned nearby ${first.match(/\[\d+\]/)?.[0] ?? ''}`.replace('new -unit', 'new') : nearby[0].title === 'Planning project nearby' ? `A project planned nearby ${first.match(/\[\d+\]/)?.[0] ?? ''}`.trim() : `${nearby[0].title}: project planned nearby ${first.match(/\[\d+\]/)?.[0] ?? ''}`.trim());
  }
  const clip = (s: string) => (s.length <= 90 ? s : s.slice(0, 87).replace(/\s+\S*$/, '') + '...');
  if (unknowns.some((u) => u.specialist === 'structural engineer')) for (const h of hazards) h.text = h.text.replace('Worth raising with a structural engineer', 'Worth raising with the structural engineer');
  watch.sort((a, b) => Number(/^Unsafe building/.test(b)) - Number(/^Unsafe building/.test(a))); // the most serious first
  const highlights = { good: good.slice(0, 5).map(clip), watch: watch.slice(0, 5).map(clip) };
  // The contract wants 2 to 5 good-news lines; plain, cited facts fill the gap.
  const fillers = [
    !failed.has('complaints') && !cases.length ? 'No open complaints or city cases' : '',
    yearBuilt && rollSrc ? `Built in ${yearBuilt}, on the assessor's roll ${c(rollSrc)}` : '',
    hz && hz.femaZone && !/^(A|V)/.test(hz.femaZone) ? `Outside FEMA flood zones ${c(S.hazards(pid))}` : '',
    assessed && rollSrc ? `Assessed at ${money(assessed)} as of ${fmtDate(lien)} ${c(rollSrc)}` : '',
    'Records were found for this address',
  ].filter(Boolean);
  for (const f of fillers) { if (highlights.good.length >= 2) break; if (!highlights.good.includes(f)) highlights.good.push(clip(f)); }
  if (!highlights.watch.length) highlights.watch.push('Nothing stands out in the records');

  /* ----- history ----- */
  const history: HistoryRow[] = [];
  const cited = (id: string) => cites.has(id) ? `[${cites.list.findIndex((s) => s.id === id) + 1}]` : null;
  if (firstUnitComplaint) {
    const ref = cited(`complaint:${firstUnitComplaint.complaint_number}`);
    if (ref) {
      history.push({ date: day(firstUnitComplaint.date_filed), kind: 'complaint', text: `Complaint: illegal unit${/garage/.test(complaintText(firstUnitComplaint)) ? ' in the garage' : ''} ${ref}` });
      const second = unitComplaints.find((x) => /amendment|nov/.test(lower(x.complaint_description)) && x !== firstUnitComplaint);
      if (second) history.push({ date: String(year(second.date_filed)), kind: 'complaint', text: `Second notice of violation for the same unit ${ref}` });
    }
  }
  for (const a of active) { const ref = cited(`complaint:${a.complaint_number}`); if (ref) history.push({ date: day(a.date_filed), kind: 'complaint', text: (() => { const t = cases.find((x) => x.text.includes(a.complaint_number!))?.title ?? ''; return /^open complaint/i.test(t) || !t ? `Complaint filed ${ref}` : `Complaint: ${lower(t)} ${ref}`; })() }); }
  for (const b of buyouts) { const ref = cited(`buyout:${b.case_number}`); const bd = day(b.buyout_agreement_date ?? b.pre_buyout_disclosure_declaration_date); if (ref && bd) history.push({ date: bd, kind: 'tenant', text: (() => { const t = n(b.number_of_tenants); return `Tenant buyout${t ? `, ${t} tenant${t === 1 ? '' : 's'}` : ''} ${ref}`; })() }); }
  if (roll?.current_sales_date && rollSrc) history.push({ date: roll.current_sales_date.slice(0, 7), kind: 'sale', text: `Current owner bought the ${multiParcel ? 'unit' : (unitsNow >= 5 ? 'building' : 'house')} ${c(rollSrc)}` });
  for (const p of openPlanning) { const ref = cited(`planning:${p.record_id}`); if (ref) history.push({ date: day(p.open_date), kind: 'planning', text: `Planning opens case ${p.record_id} ${ref}` }); }
  if (hotelSrc && hotelStart) history.push({ date: day(hotelStart), kind: 'other', text: `Hotel-tax registration starts ${c(hotelSrc)}` });
  for (const p of permits) {
    const ref = cited(`permit:${p.permit_number}`);
    if (!ref) continue;
    const d = lower(p.description);
    if (p === lastUnitPermit && unitCfc) continue;
    const label = /re-?roof|roofing/.test(d) ? 'Reroof' : /bedroom.*office/.test(d) ? 'Upstairs bedroom converted to an office' : /remodel|slab|garage/.test(d) ? 'Remodel permit' : /foundation/.test(d) ? 'Foundation permit' : (() => { const w = shortWhat(p.description, ''); return w ? `${cap(w === 'baths' ? 'bathroom' : w === 'illegal unit' ? 'unit' : w)} permit` : 'Building permit'; })();
    if (isComplete(p)) history.push({ date: day(p.completed_date), kind: 'permit', text: `${label}${label.startsWith('Upstairs') ? '' : ' complete'} ${ref}` });
    else history.push({ date: day(p.issued_date ?? p.filed_date), kind: 'permit', text: `${label} issued ${ref}` });
  }
  if (finaledBaths.length) {
    const ref = cited(`plumbing:${finaledBaths[0].p.permit_number}`);
    const total = Number(ledger.find((r) => r.key === 'baths')?.records ?? 0);
    if (ref) history.push({ date: day(finaledBaths.map((x) => x.p.completed_date).sort().pop()), kind: 'permit', text: `Plumbing finals for ${total ? word(total) + ' baths' : 'new baths'} ${ref}` });
  }
  if (unitCfc) { const ref = cited(`cfc:${unitCfc.building_permit_application}`); if (ref) history.push({ date: day(unitCfc.date_issued), kind: 'permit', text: `In-law legalized, certificate issued ${ref}` }); }
  // Lot lineage: when the parcel was created, and notable permits filed under its parent before the split.
  for (const l of (raw.lineage ?? []).slice(0, 2)) {
    history.push({ date: day(l.recordeddate) || String(year(l.recordeddate) ?? ''), kind: 'other',
      text: `Parcel ${l.blklot} created from parcel ${l.oldblklot} ${c(S.lineage(l.blklot!, l.oldblklot!, day(l.recordeddate) || null))}` });
  }
  const notable = (raw.parentPermits ?? []).filter((p) => !/cancel|withdraw/i.test(p.status ?? ''))
    .map((p) => ({ p, score: (n(p.proposed_units) !== n(p.existing_units) ? 4 : 0) + (/new building|erect|construct|demoli|addition|legaliz|unit/.test(lower(p.description)) ? 2 : 0) + (isComplete(p) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || (b.p.filed_date ?? '').localeCompare(a.p.filed_date ?? '')).slice(0, 3);
  const seenParent = new Set<string>();
  for (const { p } of notable) {
    const d = day(p.completed_date ?? p.issued_date ?? p.filed_date);
    const what = shortWhat(p.description, 'building work');
    if (!d || seenParent.has(what)) continue; // one row per kind of work, not three "demolition" rows
    seenParent.add(what);
    history.push({ date: d, kind: 'permit', text: `Before the lot split: ${shortWhat(p.description, 'building work')} permit on the parent lot ${c(S.parentPermit(p))}` });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));

  /* ----- sections ----- */
  const err = (source: string): SectionState => ({ state: 'error', source, retryable: true });
  const sections: Record<SectionKey, SectionState> = {
    ledger: failed.has('permits') ? err('DBI building permits') : ledger.length ? { state: 'ok' } : { state: 'empty', text: 'The listing makes no claims to check' },
    cases: failed.has('complaints') ? err('DBI complaints') : cases.length ? { state: 'ok' } : { state: 'empty', text: 'No open city cases' },
    costs: { state: 'ok' },
    systems: failed.has('permits') && failed.has('trade_permits') ? err('DBI permits') : failed.has('trade_permits') ? err('DBI plumbing and electrical permits') : { state: 'ok' },
    tenants: failed.has('tenants') ? err('Rent Board buyouts') : { state: 'ok' },
    upside: failed.has('zoning') && !upside.length ? err('Planning zoning map') : upside.length ? { state: 'ok' } : { state: 'empty', text: 'No zoning record found' },
    hazards: failed.has('hazards') || !hazards.length ? err('Hazard maps') : { state: 'ok' },
    nearby: failed.has('nearby') ? err('Planning projects nearby') : nearby.length ? { state: 'ok' } : { state: 'empty', text: 'No projects within 150 m' },
    history: history.length ? { state: 'ok' } : { state: 'empty', text: 'No dated records found' },
    unknowns: unknowns.length ? { state: 'ok' } : { state: 'empty', text: 'Nothing left to ask' },
    packet: { state: 'empty', text: 'No disclosure packet added' },
  };

  /* ----- answer and drafts (rule sentences; writer.ts may improve them) ----- */
  const missed = (['permits', 'complaints', 'planning'] as const).filter((k) => failed.has(k));
  const unsafeNov = novs.find((v) => v.unsafe_building === 'Y' && /^active/i.test(v.status ?? ''));
  const unsafeRow = unsafeNov ? active.find((a) => a.complaint_number === unsafeNov.complaint_number) ?? unsafeNov : null;
  const answerBase = ruleAnswer({ unsafe: unsafeRow, multiParcel, unitsNow, unitLegalized, lastUnitPermit, unitCfc, rollSrc, ledger, cases, c, tone, active, aduRow });
  const missedNote = missed.length ? ` ${missed.map((k) => ({ permits: 'Building permits', complaints: 'City complaints', planning: 'Planning records' })[k]).join(' and ')} couldn't be read this time.` : '';
  const answer = (answerBase + missedNote).length <= 220 ? answerBase + missedNote : answerBase;
  const drafts = ruleDrafts({ addr, unknowns, cases, openPlanning, lastUnitPermit, unitCfc, agentEmail: input.agentEmail, permits, ledger, active, hotelStart, trade: multiParcel ? [] : [...plumbing, ...electrical], listingText: input.listingText });

  return {
    id: input.reportId,
    version: 1,
    createdAt: input.now.toISOString(),
    checkedAt: input.now.toISOString(),
    address: addr.display,
    parcels: addr.parcels.map((p) => p.parcel),
    parcelDisplay: parcelDisplay(addr.parcels),
    meta: { zoning, neighborhood: roll?.assessor_neighborhood ?? addr.neighborhood ?? null, yearBuilt, lotSqft },
    listing: { text: input.listingText, claims },
    answer,
    answerBy: 'rules', // the writer sets 'ai' when Claude's text passes the checks
    decision,
    glance,
    highlights,
    sections,
    ledger,
    cases,
    costs: { price, assessedValue: assessed, rows, inputs },
    systems,
    tenants,
    upside,
    hazards,
    nearby,
    history,
    unknowns,
    sources: cites.list,
    actions: [],
    drafts,
  };
}

/** "baths, sq ft and the renovation [1][4]": each claim's name, with the citations its row already carries. */
function claimList(rows: ClaimRow[]): string {
  const names = rows.map((r) => (r.key === 'renovation' ? 'the renovation' : r.key === 'adu' ? 'the in-law' : r.title.toLowerCase()));
  const refs = [...new Set(rows.map((r) => r.why.match(/\[\d+\]/)?.[0]).filter(Boolean))].slice(0, 3).join('');
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${list}${refs ? ' ' + refs : ''}`;
}

function ruleAnswer(x: { unsafe?: Row | null; multiParcel: boolean; unitsNow: number; unitLegalized: boolean; lastUnitPermit: Row | null; unitCfc: Row | null; rollSrc: ReturnType<typeof S.roll> | null; ledger: ClaimRow[]; cases: CaseRow[]; c: (...s: any[]) => string; tone: string; active: Row[]; aduRow?: ClaimRow }): string {
  const unitsWord = x.unitsNow === 1 ? 'one-unit' : `${word(x.unitsNow)}-unit`;
  // "A two-unit home", "An 83-unit building", "A property with no housing units on record".
  const desc = x.unitsNow <= 0 ? 'property with no housing units on record' : `${unitsWord} ${x.unitsNow >= 5 ? 'building' : 'home'}`;
  const A = `${/^(8|11-|18-|eight|eleven|eighteen)/i.test(desc) ? 'An' : 'A'} ${desc}`;
  if (x.multiParcel) {
    const differ = x.ledger.filter((r) => ['no_permit_found', 'records_differ', 'permitted_not_finaled', 'open_case'].includes(r.label));
    if (x.active.length) return `${x.unitsNow >= 2 ? `A condo unit in a ${word(x.unitsNow)}-unit building` : 'A condo unit'} with ${word(x.active.length)} active city complaint${x.active.length > 1 ? 's' : ''} at the address ${x.c(...x.active.slice(0, 2).map(S.complaint))}. Ask whether ${x.active.length > 1 ? 'they involve' : 'it involves'} this unit.`;
    return `${x.unitsNow >= 2 ? `A condo unit in a ${word(x.unitsNow)}-unit building.` : 'A condo unit.'} ${x.tone === 'clear' && onlySize(differ) ? sizeGap(differ) : differ.length ? `${differ.length === 1 ? 'One listing claim differs' : `${cap(word(differ.length))} listing claims differ`} from city records: ${claimList(differ)}.` : !x.ledger.length ? `No open city complaints at the address${x.rollSrc ? ' ' + x.c(x.rollSrc) : ''}.` : x.ledger.some((r) => !MATCHED.includes(r.label)) ? `City records don't settle ${claimList(x.ledger.filter((r) => !MATCHED.includes(r.label)))}.` : `The unit's records match the listing${x.rollSrc ? ' ' + x.c(x.rollSrc) : ''}.`}`;
  }
  if (x.unitLegalized && x.lastUnitPermit) {
    const stale = x.ledger.some((r) => r.label === 'permitted_not_updated');
    return `A legal ${unitsWord} home. The in-law was legalized and signed off in ${year(x.lastUnitPermit.completed_date)} ${x.c(S.permit(x.lastUnitPermit), x.unitCfc ? S.cfc(x.unitCfc) : null)}${stale ? `, so the assessor still showing ${x.unitsNow - 1 === 1 ? 'one unit' : 'fewer units'} and one bath is out of date ${x.c(x.rollSrc)}` : ''}.`;
  }
  if (x.unsafe) return `The city flagged ${x.unsafe.complaint_number ? `complaint ${x.unsafe.complaint_number}` : 'a notice'} at this address as an unsafe building, and it is still active ${x.c(S.complaint(x.unsafe))}. Ask the seller and the city what it covers before you go further.`;
  if (x.active.length) {
    return `${A} with ${word(x.active.length)} active city complaint${x.active.length > 1 ? 's' : ''} ${x.c(...x.active.slice(0, 2).map(S.complaint))}${x.aduRow?.label === 'no_permit_found' ? ', and no permit for the in-law' : ''}.${x.ledger.some((r) => r.key === 'renovation') ? ' Work is permitted but not signed off.' : ` Ask how ${x.active.length > 1 ? 'they' : 'it'} will be closed before you offer.`}`;
  }
  const problems = x.ledger.filter((r) => ['no_permit_found', 'records_differ', 'permitted_not_finaled'].includes(r.label));
  // With a clear verdict the only gaps are the assessor's size and bedroom figures, which often lag the house.
  if (x.tone === 'clear' && onlySize(problems))
    return `${A}. ${sizeGap(problems)}`;
  if (problems.length) return `${A}. ${problems.length === 1 ? 'One listing claim differs' : `${cap(word(problems.length))} listing claims differ`} from city records: ${claimList(problems)}.`;
  // Only say "match the listing" when the listing claimed something the records confirm.
  const roll = x.rollSrc ? ' ' + x.c(x.rollSrc) : '';
  if (!x.ledger.length) return `${A} on record${roll}, with no open city complaints.`;
  const unsettled = x.ledger.filter((r) => !MATCHED.includes(r.label));
  if (unsettled.length) return `${A}. ${unsettled.length === x.ledger.length ? 'City records' : 'Other claims match, but city records'} don't settle ${claimList(unsettled)}.`;
  return `${A} whose records match the listing${roll}.`;
}
/** Only the assessor's size or bedroom figures differ: common, and worth one question, not alarm. */
function sizeGap(rows: ClaimRow[]): string {
  const names = rows.map((r) => (r.key === 'sqft' ? 'square footage' : 'bedroom count')).join(' and ');
  const refs = [...new Set(rows.map((r) => r.why.match(/\[\d+\]/)?.[0]).filter(Boolean))].join('');
  return `The assessor's ${names} ${rows.length > 1 ? 'differ' : 'differs'} from the listing${refs ? ' ' + refs : ''}, which is common in older records. Ask how the listing ${rows.length > 1 ? 'counted them' : rows[0].key === 'sqft' ? 'measured it' : 'counted them'}.`;
}
const onlySize = (rows: ClaimRow[]) => rows.length > 0 && rows.every((r) => r.key === 'sqft' || r.key === 'beds');
const MATCHED: FindingLabel[] = ['matches', 'resolved', 'matches_planning', 'permitted_not_updated'];

function ruleDrafts(x: { addr: ResolvedAddress; unknowns: Unknown[]; cases: CaseRow[]; openPlanning: Row[]; lastUnitPermit: Row | null; unitCfc: Row | null; agentEmail: string | null; permits: Row[]; ledger: ClaimRow[]; active: Row[]; hotelStart: string | null; trade: Row[]; listingText: string }): Report['drafts'] {
  const a = x.addr.display;
  const qs: string[] = [];
  const ids: string[] = [];
  const add = (id: string, q: string) => { if (x.unknowns.some((u) => u.id === id)) { qs.push(q); ids.push(id); } };
  const tq = x.unknowns.find((u) => u.id === 'u-tenants')?.title ?? 'Is either unit rented?';
  add('u-tenants', `${tq.replace(/ rented\?$/, ' currently rented?')} If so, what are the rents and lease terms?`);
  const hy = year(x.hotelStart);
  add('u-short-term', `City records show a hotel-tax registration at this address${hy ? ` since ${hy}` : ''}. Are any short-term rental bookings scheduled after closing?`);
  if (x.unknowns.some((u) => u.id === 'u-close-cases')) {
    const all = x.active.map((c) => c.complaint_number!).filter(Boolean).sort();
    const nums = all.length > 4 ? all.slice(-3) : all; // a long list goes as "the 3 newest and N more"
    const list = all.length > 4 ? `${nums.join(', ')} and ${all.length - 3} more` : nums.length > 1 ? `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}` : nums[0];
    if (nums.length) add('u-close-cases', `What is the status of complaint${nums.length > 1 ? 's' : ''} ${list}? Will ${nums.length > 1 ? 'they' : 'it'} be closed, with fees paid, before closing?`);
    else add('u-close-cases', 'Will the open permits and cases be closed, with fees paid, before closing?');
    // The main job (largest live building permit by cost), then one plumbing and one electrical permit.
    const issued = (p: Row) => isLive(p) && /issued/i.test(p.status ?? '');
    const cost = (p: Row) => Number(p.revised_cost ?? p.estimated_cost ?? 0) || 0;
    const main = x.permits.filter(issued).sort((a, b) => cost(b) - cost(a))[0];
    const pp = x.trade.find((p) => issued(p) && /^PP/i.test(p.permit_number ?? ''));
    const el = x.trade.find((p) => issued(p) && /^E/i.test(p.permit_number ?? ''));
    const open = [main, pp, el].map((p) => p?.permit_number).filter(Boolean) as string[];
    if (open.length) qs.push(`When do you expect final inspections on permit${open.length > 1 ? 's' : ''} ${open.length > 1 ? `${open.slice(0, -1).join(', ')} and ${open[open.length - 1]}` : open[0]}?`);
  }
  const bedPermit = x.permits.find((p) => /bedroom/.test(lower(p.description)) && isComplete(p));
  const by = bedPermit ? year(bedPermit.completed_date) : null;
  add('u-bedrooms', `Could you share the floor plan? Public records don't list bedrooms, and a ${by ?? 'recent'} permit converted one to an office.`);
  add('u-garden-unit', `The listing mentions ${/garden in-?law/i.test(x.listingText) ? 'a garden in-law' : /\badu\b/i.test(x.listingText) ? 'an ADU' : 'an in-law unit'}. Is it a permitted unit, and is anyone living there?`);
  const docs = [x.lastUnitPermit?.permit_number, ...x.permits.filter((p) => /complete/.test(p.status ?? '') && /remodel|bath|stair|adu/.test(lower(p.description)) && p !== x.lastUnitPermit).map((p) => p.permit_number)].filter(Boolean).slice(0, 2);
  const want = ['the 3R report', ...(x.unknowns.some((u) => u.id === 'u-excavation') ? ["the shoring plans and the engineer's letters for the excavation"] : []),
    ...(docs.length ? [`the job cards for permit${docs.length > 1 ? 's' : ''} ${docs.join(' and ')}`] : []),
    ...(x.unitCfc ? [`the certificate of final completion for ${(x.unitCfc.building_address ?? '').match(/^\d+[A-Z]?\b/i)?.[0]?.toUpperCase() ?? 'the in-law unit'}`] : [])];
  // "A and B"; "A, B and C" reads wrong when an item has its own "and", so those lists use commas.
  const joined = want.length === 1 ? want[0] : want.length === 2 ? (/ and the /.test(want[1]) ? want.join(', ') : want.join(' and ')) : `${want.slice(0, -1).join(', ')}, and ${want[want.length - 1]}`;
  qs.push(`Could you share ${joined}?`);
  if (x.openPlanning[0]) qs.push(`Do you know whether Planning has closed enforcement case ${x.openPlanning[0].record_id}?`);
  const listingAgentEmail: EmailDraft | null = qs.length ? {
    to: x.agentEmail, subject: `Questions about ${a}`,
    body: `Hi,\n\nI'm interested in ${a} and have ${qs.length === 1 ? 'a question' : 'a few questions'} before making an offer.\n\n${qs.length === 1 ? qs[0] : qs.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nThanks,\n`,
    unknownIds: ids,
  } : null;
  const p = x.openPlanning[0];
  const P = x.addr.parcels[0];
  let cityEmail: EmailDraft | null = null;
  if (p && P) {
    cityEmail = {
      to: 'pic@sfgov.org', subject: `Status of enforcement case ${p.record_id}, ${a}`,
      body: `Hello,\n\nI'm considering buying ${a} (block ${P.block}, lot ${P.lot}). Planning case ${p.record_id} still shows "${lower(p.record_status)}"${ILLEGAL_UNIT.test(lower(p.description)) ? ' with an unauthorized unit noted' : ''}.${x.lastUnitPermit && x.unitCfc ? ` The unit was legalized under permit ${x.lastUnitPermit.permit_number}, with a certificate of final completion issued ${fmtDate(x.unitCfc.date_issued)}.` : ''}\n\nCould you confirm whether the case is closed, or what remains open?\n\nThanks,\n`,
      unknownIds: x.unknowns.filter((u) => u.id === 'u-planning-case').map((u) => u.id),
    };
  } else if (x.active.length && P) {
    cityEmail = {
      to: 'dbi.cod@sfgov.org', subject: `Status of complaints at ${a}`,
      body: `Hello,\n\nI'm considering buying ${a} (block ${P.block}, lot ${P.lot}). Complaint${x.active.length > 1 ? 's' : ''} ${x.active.map((c) => c.complaint_number).join(' and ')} show${x.active.length > 1 ? '' : 's'} as active.\n\nCould you tell me what is needed to close ${x.active.length > 1 ? 'them' : 'it'}, and whether any fees or liens are pending?\n\nThanks,\n`,
      unknownIds: [],
    };
  }
  return { listingAgentEmail, cityEmail };
}
