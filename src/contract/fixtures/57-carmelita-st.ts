import type { MoneyInputs, Report, StepEvent } from '../types';
import { computeCosts } from '../money';

/**
 * Second golden fixture: a remodel in progress with active complaints. Real City records (DataSF,
 * checked 2026-11-20); the listing text is an example. Exercises open cases, case fees, a specialist
 * booking, a hazard note and an empty-ish nearby section.
 */
const R = 'https://data.sf.gov/resource/';
const D = 'https://data.sf.gov/d/';

const inputs: MoneyInputs = {
  assessedValue: 2_703_000, ownerOccupied: true, melloRoosPerSqft: null, sqft: null, openCaseMonthlyFee: 152,
  sourceIndex: { taxRate: 9, supplemental: 10, transferTax: 11, caseFees: 12 },
};

export const steps57: StepEvent[] = [
  { type: 'step', id: 'parcel', glyph: 'parcel', title: 'Found the parcel', status: 'done', detail: '0863-007' },
  { type: 'step', id: 'roll', glyph: 'roll', title: "Read the assessor's roll", status: 'done', detail: 'As of Jan 1, 2025' },
  { type: 'step', id: 'permits', glyph: 'permit', title: 'Read building permits', status: 'done', detail: '3 open permits' },
  { type: 'step', id: 'trade_permits', glyph: 'plumbing', title: 'Read plumbing and electrical permits', status: 'done', detail: '2 issued, none final' },
  { type: 'step', id: 'complaints', glyph: 'complaint', title: 'Read complaints and notices of violation', status: 'done', detail: '2 active' },
  { type: 'step', id: 'planning', glyph: 'planning', title: 'Read Planning records', status: 'done', detail: '2 records, historic district' },
  { type: 'step', id: 'tenants', glyph: 'tenants', title: 'Read tenant buyouts and business registrations', status: 'done', detail: 'None found' },
  { type: 'step', id: 'hazards', glyph: 'hazard', title: 'Checked hazard zones', status: 'done', detail: '8 maps, 1 zone' },
  { type: 'step', id: 'nearby', glyph: 'nearby', title: 'Read projects nearby', status: 'done', detail: '1 street permit' },
  { type: 'step', id: 'money', glyph: 'money', title: 'Worked out taxes and fees', status: 'done', detail: 'At the asking price' },
];

export const report57: Report = {
  id: '57-carmelita-st-fixture',
  version: 1,
  createdAt: '2026-11-20T22:00:00.000Z',
  checkedAt: '2026-11-20T22:00:00.000Z',
  address: '57 Carmelita St',
  parcels: ['0863007'],
  parcelDisplay: '0863-007',
  meta: { zoning: 'RH-2', neighborhood: 'Duboce Triangle', yearBuilt: 1900, lotSqft: 3349 },
  listing: {
    text: 'Example listing: 57 Carmelita St, San Francisco. Duboce Park Victorian, fully renovated 2026. 3 bed, 3 bath, about 2,700 sq ft, garden in-law. Offered at $3,295,000.',
    claims: { address: '57 Carmelita St', price: 3_295_000, units: 1, beds: 3, baths: 3, sqft: 2700, adu: 'claimed', renovations: ['fully renovated 2026'] },
  },
  answer: 'A remodel still in progress, with two active complaints about excavation [3][4]. The permits are issued but not signed off [2][5], and no permit creates the garden in-law [2].',
  decision: {
    tone: 'caution',
    title: 'Get it checked before you offer',
    inspection: 'Book a structural engineer to look at the excavation along the south property line and rear [3][4]. The rest the seller can answer in writing.',
  },
  glance: [
    { section: 'ledger', glyph: 'parcel', label: 'Legal units', value: '1', tone: 'error', status: 'In-law not permitted' },
    { section: 'cases', glyph: 'violation', label: 'Open city cases', value: '2', tone: 'error', status: 'Active complaints' },
    { section: 'costs', glyph: 'money', label: 'Property tax', value: null, tone: 'neutral', status: 'A month at asking' },
    { section: 'tenants', glyph: 'tenants', label: 'Tenants', value: 'None found', tone: 'success', status: 'No buyouts on file' },
    { section: 'hazards', glyph: 'landslide', label: 'Hazards', value: '1 of 8', tone: 'warning', status: 'Landslide class 7' },
    { section: 'upside', glyph: 'zoning', label: 'Room to grow', value: 'RH-2', tone: 'info', status: 'Historic district' },
  ],
  highlights: {
    good: [
      'Plumbing, wiring and foundation work all have permits [2][5][7]',
      'Outside FEMA flood zones [8]',
      'No tenant buyouts on file [20]',
      'Roof replaced in 2016 [22]',
    ],
    watch: [
      'Two active complaints about excavation [3][4]',
      'Remodel permit not signed off yet [2]',
      'No permit for the garden in-law [2]',
      'Open complaints cost $152 a month in fees [12]',
      'Landslide susceptibility class 7 of 10 [13]',
    ],
  },
  sections: {
    ledger: { state: 'ok' }, cases: { state: 'ok' }, costs: { state: 'ok' }, systems: { state: 'ok' }, tenants: { state: 'ok' },
    upside: { state: 'ok' }, hazards: { state: 'ok' }, nearby: { state: 'ok' }, history: { state: 'ok' }, unknowns: { state: 'ok' },
    packet: { state: 'empty', text: 'No disclosure packet added' },
  },
  ledger: [
    { key: 'renovation', title: 'Renovated', listing: '2026', records: 'Not finaled', label: 'open_case',
      why: 'Permit 202510157458 ($616,835) was issued Mar 27, 2026 and has no final inspection [2]. Two complaints during the work are active [3][4].' },
    { key: 'baths', title: 'Baths', listing: '3', records: '3 permitted', label: 'permitted_not_finaled',
      why: 'Plumbing permit PP20260427726 covers three bathrooms and is issued, with no final inspection [5]. The assessor records 1 bath [1].' },
    { key: 'adu', title: 'In-law', listing: 'Garden in-law', records: 'None', label: 'no_permit_found',
      why: 'The remodel permit keeps the building at one unit [2]. Complaints in 2021 and 2022 asked about an unpermitted garden apartment, and Planning closed a short-term rental case in 2021 [6].' },
    { key: 'sqft', title: 'Sq ft', listing: '2,700', records: '1,900 to 2,745', label: 'records_disagree',
      why: 'Planning lists 2,745 sq ft of existing floor area, and 2,861 after the approved remodel [21]. The assessor lists 1,900 [1]. Ask how the listing measured it.' },
    { key: 'units', title: 'Units', listing: '1 plus in-law', records: '1', label: 'records_differ',
      why: 'Every record for this parcel shows one legal unit [1][2].' },
  ],
  cases: [
    { glyph: 'violation', title: 'Over-excavation at the rear', label: 'open_case',
      text: 'Complaint 202665866, filed Nov 17, 2026. Work without a permit and work beyond the permit [4].',
      stake: 'Open complaints pass to the next owner, with fees of $152 a month while open [12]' },
    { glyph: 'violation', title: 'Excavation before a shoring permit', label: 'open_case',
      text: 'Complaint 202655072, filed Apr 24, 2026. A 20 ft section along the south property line was dug about 5 ft deep [3].',
      stake: 'Monthly monitoring fee applies while open [12]' },
  ],
  costs: { price: 3_295_000, assessedValue: 2_703_000, inputs, rows: computeCosts(3_295_000, inputs, new Date('2026-12-01T12:00:00Z')) },
  systems: [
    { glyph: 'plumbing', title: 'Plumbing', year: 2026, status: 'in_progress', text: 'Galvanized pipes and main stack being replaced, permit issued, not final [5]' },
    { glyph: 'electrical', title: 'Wiring', year: 2026, status: 'in_progress', text: 'Electrical permit issued with the remodel, not final [7]' },
    { glyph: 'foundation', title: 'Foundation', year: 2026, status: 'in_progress', text: 'New lower slab and grade beams, under the open excavation complaints. A foundation repair permit to comply with the notice was issued May 22, 2026 [2][3][23]' },
    { glyph: 'roof', title: 'Roof', year: 2016, status: 'updated', text: 'Reroofed, permit complete May 2, 2016 [22]' },
  ],
  tenants: [
    { glyph: 'tenants', title: 'Rent control', text: 'One legal unit. A rented garden unit, permitted or not, can bring eviction protections with it. Confirm with the Rent Board.' },
    { glyph: 'resolved', title: 'No buyouts or hotel-tax registrations', text: 'No tenant buyout on file for this address [20].', muted: true },
  ],
  upside: [
    { glyph: 'zoning', title: 'Zoning RH-2', text: 'Residential, two-family district. A second unit is allowed in principle, with its own permit.' },
    { glyph: 'planning', title: 'Historic district', text: 'In the Duboce Park landmark district, so exterior changes go through historic review [14].' },
  ],
  hazards: [
    { key: 'flood', title: 'Flood', status: 'clear', text: 'FEMA zone X, minimal flood hazard [8]' },
    { key: 'storm_flood', title: 'Storm flooding', status: 'clear', text: "Outside the city's 100-year storm flood zone [15]" },
    { key: 'liquefaction', title: 'Liquefaction', status: 'clear', text: 'Outside the state liquefaction zone [8]' },
    { key: 'landslide', title: 'Landslide', status: 'note', text: "Susceptibility class 7 on the city's landslide map, where 10 is highest [13]. Worth raising with the structural engineer." },
    { key: 'tsunami', title: 'Tsunami', status: 'clear', text: 'Outside the tsunami hazard area [8]' },
    { key: 'sea_level', title: 'Sea level rise', status: 'clear', text: 'Outside the sea level rise maps, even with 66 inches of rise [17]' },
    { key: 'reservoir', title: 'Reservoir', status: 'clear', text: 'Outside every reservoir failure zone [16]' },
    { key: 'soil', title: 'Soil', status: 'clear', text: 'Outside the Maher soil testing area [18]' },
  ],
  nearby: [
    { glyph: 'nearby', title: 'Street-space permit', text: 'A street-space permit on this frontage runs to Jan 24, 2027, and curb cut permit 26DW-00035 is on file [19].' },
  ],
  history: [
    { date: '2016', kind: 'planning', text: 'Planning case on a short-term rental, closed 2021 [6]' },
    { date: '2021', kind: 'complaint', text: 'Complaints about a garden apartment, closed [6]' },
    { date: '2023-12', kind: 'sale', text: 'Current owner bought the house [1]' },
    { date: '2026-03-27', kind: 'permit', text: 'Remodel permit issued, $616,835 [2]' },
    { date: '2026-04-24', kind: 'complaint', text: 'Complaint: excavation before shoring [3]' },
    { date: '2026-11-17', kind: 'complaint', text: 'Complaint: over-excavation at the rear [4]' },
  ],
  unknowns: [
    { id: 'u-excavation', title: 'Is the excavation sound?', why: 'Two active complaints about digging along the property line [3][4]. Only a site visit answers this.', resolver: 'specialist', action: 'book_specialist', specialist: 'structural engineer' },
    { id: 'u-close-cases', title: 'Will the complaints and permits close before you do?', why: 'An open case passes to the next owner, and so do its fees [12].', resolver: 'listing_agent', action: 'email_listing_agent' },
    { id: 'u-garden-unit', title: 'What is the garden in-law, legally?', why: 'No permit creates a second unit [2]. Ask whether anyone lives there.', resolver: 'listing_agent', action: 'email_listing_agent' },
  ],
  sources: [
    { id: 'roll:0863007:2025', title: "Assessor's roll 2025, parcel 0863007", publisher: 'SF Assessor-Recorder', date: '2025-01-01', url: R + 'wv5m-vpq2.json?parcel_number=0863007&closed_roll_year=2025', dataset: 'wv5m-vpq2' },
    { id: 'permit:202510157458', title: 'Building permit 202510157458, remodel', publisher: 'DBI', date: '2026-03-27', url: R + 'i98e-djp9.json?permit_number=202510157458', dataset: 'i98e-djp9' },
    { id: 'complaint:202655072', title: 'Complaint 202655072, excavation', publisher: 'DBI', date: '2026-04-24', url: R + 'gm2e-bten.json?complaint_number=202655072', dataset: 'gm2e-bten' },
    { id: 'complaint:202665866', title: 'Complaint 202665866, over-excavation', publisher: 'DBI', date: '2026-11-17', url: R + 'gm2e-bten.json?complaint_number=202665866', dataset: 'gm2e-bten' },
    { id: 'plumbing:PP20260427726', title: 'Plumbing permit PP20260427726, three baths', publisher: 'DBI', date: '2026', url: R + 'a6aw-rudh.json?permit_number=PP20260427726', dataset: 'a6aw-rudh' },
    { id: 'planning:0863007', title: 'Planning records, block 0863 lot 007', publisher: 'SF Planning', date: '2025', url: R + 'y673-d69b.json?block=0863&lot=007', dataset: 'y673-d69b' },
    { id: 'electrical:0863007', title: 'Electrical permits, block 0863 lot 007', publisher: 'DBI', date: '2026', url: R + 'ftty-kx6y.json?block=0863&lot=007', dataset: 'ftty-kx6y' },
    { id: 'hazards:0863007', title: 'FEMA flood map, state seismic hazard and tsunami zones', publisher: 'FEMA, California Geological Survey', date: '2021', url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28' },
    { id: 'tax:rate:2026-27', title: 'Tax rate resolution, FY 2026-27', publisher: 'Board of Supervisors', date: '2026-09-22', url: 'https://media.api.sf.gov/documents/r0524-26.pdf' },
    { id: 'tax:supplemental', title: 'Supplemental assessments', publisher: 'SF Assessor-Recorder', date: '2026', url: 'https://www.sf.gov/information--learn-about-supplemental-assessments' },
    { id: 'tax:transfer', title: 'Who pays what: California transfer taxes', publisher: 'Fidelity National Financial', date: '2026-01-06', url: 'https://page.fnf.com/rs/393-REY-847/images/Who%20Pays%20What%20-%20California%20Transfer%20Tax%20and%20Fees%20%28rev%2001062026%29.pdf' },
    { id: 'fees:dbi:2026', title: 'Penalties and code enforcement fees 2026', publisher: 'DBI', date: '2026-07-12', url: 'https://media.api.sf.gov/documents/Table_1A-K_-_Penalities_Hearings_Code_Enforcement_Assessments_2026.pdf' },
    { id: 'landslide:0863007', title: 'Landslide susceptibility map', publisher: 'SF Planning', date: null, url: D + 'bna4-itif', dataset: 'bna4-itif' },
    { id: 'historic:0863007', title: 'Historic districts, Duboce Park', publisher: 'SF Planning', date: null, url: D + '63x5-g3m4', dataset: '63x5-g3m4' },
    { id: 'stormflood:0863007', title: '100-year storm flood risk zone', publisher: 'SFPUC', date: '2022-07', url: D + 'jzu3-4yxp', dataset: 'jzu3-4yxp' },
    { id: 'reservoir:0863007', title: 'Reservoir failure inundation zones', publisher: 'SFPUC', date: null, url: D + '7crf-46s6', dataset: '7crf-46s6' },
    { id: 'sealevel:0863007', title: 'Sea level rise maps, 24 and 66 inches', publisher: 'SF Planning', date: '2020', url: D + 'esku-ejgv', dataset: 'esku-ejgv' },
    { id: 'maher:0863007', title: 'Maher soil and groundwater ordinance area', publisher: 'SF Public Health', date: null, url: D + 'v5ic-hjgw', dataset: 'v5ic-hjgw' },
    { id: 'street:0863007', title: 'Street-space and curb cut permits, 57 Carmelita St', publisher: 'SF Public Works', date: '2026', url: D + 'fxfq-npa9', dataset: 'fxfq-npa9' },
    { id: 'buyout:0863007', title: 'Tenant buyout declarations', publisher: 'SF Rent Board', date: null, url: D + 'wmam-7g8d', dataset: 'wmam-7g8d' },
    { id: 'planning:2025-000145PRJ', title: 'Planning project 2025-000145PRJ, remodel', publisher: 'SF Planning', date: '2025-01-27', url: R + 'qvu5-m3a2.json?record_id=2025-000145PRJ', dataset: 'qvu5-m3a2' },
    { id: 'permit:201511172842', title: 'Building permit 201511172842, reroof', publisher: 'DBI', date: '2016-05-02', url: R + 'i98e-djp9.json?permit_number=201511172842', dataset: 'i98e-djp9' },
    { id: 'permit:202605121128', title: 'Building permit 202605121128, foundation', publisher: 'DBI', date: '2026-05-22', url: R + 'i98e-djp9.json?permit_number=202605121128', dataset: 'i98e-djp9' },
  ],
  actions: [],
  drafts: {
    listingAgentEmail: {
      to: null,
      subject: 'Questions about 57 Carmelita St',
      body: "Hi,\n\nI'm interested in 57 Carmelita St and have a few questions before making an offer.\n\n1. What is the status of complaints 202655072 and 202665866? Will they be closed, with fees paid, before closing?\n2. When do you expect final inspections on permits 202510157458, PP20260427726 and E20260427566?\n3. The listing mentions a garden in-law. Is it a permitted unit, and is anyone living there?\n4. Could you share the 3R report, the shoring plans and the engineer's letters for the excavation?\n\nThanks,\n",
      unknownIds: ['u-close-cases', 'u-garden-unit'],
    },
    cityEmail: null,
  },
};
