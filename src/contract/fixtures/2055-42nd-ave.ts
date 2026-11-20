import type { Report, StepEvent } from '../types';
import { computeCosts } from '../money';

/**
 * Golden fixture. Real City records (DataSF, checked 2026-11-20); the listing text is an example.
 * Plan B renders it; Plan A's pipeline must produce an equivalent Report for the same listing text
 * (same labels per ledger row, same open cases, same source ids). Changing it is a contract change.
 */
const R = 'https://data.sf.gov/resource/';

const inputs = {
  assessedValue: 1_483_566, ownerOccupied: true, melloRoosPerSqft: null, sqft: null, openCaseMonthlyFee: null,
  sourceIndex: { taxRate: 12, supplemental: 13, transferTax: 14 },
};

export const steps2055: StepEvent[] = [
  { type: 'step', id: 'parcel', glyph: 'parcel', title: 'Found the parcel', status: 'done', detail: '2162-008 and 2055A' },
  { type: 'step', id: 'roll', glyph: 'roll', title: "Read the assessor's roll", status: 'done', detail: 'As of Jan 1, 2025' },
  { type: 'step', id: 'permits', glyph: 'permit', title: 'Read building permits', status: 'done', detail: '7 permits' },
  { type: 'step', id: 'trade_permits', glyph: 'plumbing', title: 'Read plumbing and electrical permits', status: 'done', detail: '2 plumbing finals' },
  { type: 'step', id: 'complaints', glyph: 'complaint', title: 'Read complaints and notices of violation', status: 'done', detail: '4 complaints, all closed' },
  { type: 'step', id: 'planning', glyph: 'planning', title: 'Read Planning records', status: 'done', detail: '3 records' },
  { type: 'step', id: 'hazards', glyph: 'hazard', title: 'Checked hazard zones', status: 'done', detail: 'Flood zone X' },
  { type: 'step', id: 'money', glyph: 'money', title: 'Worked out taxes and fees', status: 'done', detail: 'At the asking price' },
];

export const report2055: Report = {
  id: '2055-42nd-ave-fixture',
  version: 1,
  createdAt: '2026-11-20T22:00:00.000Z',
  checkedAt: '2026-11-20T22:00:00.000Z',
  address: '2055 42nd Ave',
  parcels: ['2162008'],
  parcelDisplay: '2162-008',
  meta: { zoning: 'RH-1', neighborhood: 'Outer Sunset', yearBuilt: 1947, lotSqft: 2996 },
  listing: {
    text: 'Example listing: 2055 42nd Ave, San Francisco. Fully remodeled Sunset home with a legal in-law. 2 units, 3 bed, 4 bath, about 2,000 sq ft. Offered at $1,595,000.',
    claims: { address: '2055 42nd Ave', price: 1_595_000, units: 2, beds: 3, baths: 4, sqft: 2000, adu: 'legal', renovations: ['remodeled'] },
  },
  answer: 'A legal two-unit home. The ground-floor unit was legalized in 2025 [2][4] after illegal-unit complaints from 2014 to 2018 [6]. Plumbing finals support four baths [3], though the assessor still lists one bath and one unit [1].',
  decision: {
    tone: 'clear',
    title: 'Records answer the big questions',
    text: 'A standard inspection covering both units is enough. One Planning case still reads "under review" and is worth one question to Planning [7].',
  },
  sections: {
    ledger: { state: 'ok' }, cases: { state: 'ok' }, costs: { state: 'ok' }, bones: { state: 'ok' }, tenants: { state: 'ok' },
    upside: { state: 'ok' }, around: { state: 'ok' }, history: { state: 'ok' }, unknowns: { state: 'ok' },
    packet: { state: 'empty', text: 'No disclosure packet added' },
  },
  ledger: [
    { key: 'units', title: 'Units', listing: '2', records: '2, ADU certified May 16, 2025', label: 'permitted_not_updated',
      why: "Permit 202301190427 legalized the ground-floor unit under the ADU program and closed with a certificate of final completion [2][4]. The assessor's roll is a snapshot from Jan 1, 2025, before that work finished [1]." },
    { key: 'baths', title: 'Baths', listing: '4', records: '4 with plumbing finals', label: 'permitted_not_updated',
      why: 'Two plumbing permits passed final inspection on Apr 30, 2025: two baths in the ADU and two new baths upstairs [3][5]. The assessor still records 1 bath [1].' },
    { key: 'sqft', title: 'Sq ft', listing: '2,000', records: '2,006 Planning, 1,300 assessor', label: 'matches_planning',
      why: "Planning approved the ADU project at 2,006 sq ft of floor area, up from 1,216 [7]. The assessor's 1,300 predates the work [1]." },
    { key: 'adu', title: 'In-law', listing: 'Legal', records: 'Legalized 2025', label: 'resolved',
      why: 'Complaints in 2014, 2017 and 2018 cited an illegal unit with no windows or ventilation in the bedroom [6]. The 2023 permit was filed to comply with both notices of violation and is complete [2].' },
    { key: 'beds', title: 'Bedrooms', listing: '3', records: null, label: 'not_settled',
      why: 'The assessor leaves bedrooms blank for this parcel. A 2025 permit converted one upstairs bedroom to an office [8]. Ask for the floor plan.' },
  ],
  cases: [
    { glyph: 'planning', title: 'Planning enforcement case still "under review"', label: 'likely_stale',
      text: 'Case 2022-007735ENF, opened Jul 11, 2022, notes an unauthorized unit. The unit was certified in 2025, so this is likely stale [7][4].' },
  ],
  costs: { price: 1_595_000, assessedValue: 1_483_566, inputs, rows: computeCosts(1_595_000, inputs, new Date('2026-12-01T12:00:00Z')) },
  bones: [
    { glyph: 'plumbing', title: 'Plumbing', text: 'Both units replumbed for new baths and kitchens, final Apr 30, 2025 [3][5]' },
    { glyph: 'roof', title: 'Roof', text: 'Reroofed, permit complete Mar 6, 2025 [9]' },
    { glyph: 'electrical', title: 'Wiring', text: 'Electrical permits filed with the 2024 remodel, complete [10]' },
    { glyph: 'foundation', title: 'Foundation and sewer lateral', text: 'No permit on record. Built 1947, so ask the inspector to look at both.', muted: true },
  ],
  tenants: [
    { glyph: 'tenants', title: 'Rent control', text: 'Two units in a building from 1947. A house with an in-law unit is usually fully rent-controlled. Confirm with the Rent Board before you plan to move in or rent out.' },
    { glyph: 'complaint', title: 'Tenants now', text: 'Not in public records. The 2014 complaint described a renter in the garage unit [6]. Ask whether either unit is occupied.' },
  ],
  upside: [
    { glyph: 'zoning', title: 'Zoning RH-1', text: 'Residential, one-family district. The legalized ADU is the second unit.' },
    { glyph: 'grow', title: 'Lot 2,996 sq ft', text: 'Above the 2,400 sq ft minimum for an SB 9 lot split. SB 9 is off the table if a unit was rented in the last 3 years [1].' },
  ],
  around: [
    { glyph: 'hazard', title: 'Flood', text: 'FEMA zone X, minimal flood hazard [11]' },
    { glyph: 'hazard', title: 'Seismic hazard zones', text: 'Outside the state liquefaction and landslide zones [11]' },
  ],
  history: [
    { date: '2014-08-05', text: 'Complaint: illegal unit in the garage [6]' },
    { date: '2017', text: 'Second notice of violation for the same unit [6]' },
    { date: '2022-02', text: 'Current owner bought the house [1]' },
    { date: '2022-07-11', text: 'Planning opens enforcement case 2022-007735ENF [7]' },
    { date: '2025-04-30', text: 'Plumbing finals for four baths [3]' },
    { date: '2025-05-16', text: 'ADU legalization complete, certificate issued [4]' },
    { date: '2025-07-08', text: 'Upstairs bedroom converted to an office [8]' },
  ],
  unknowns: [
    { id: 'u-planning-case', title: 'Is the Planning case closed?', why: 'Case 2022-007735ENF still reads "under review". A clean close-out protects resale [7].', resolver: 'city', action: 'email_city' },
    { id: 'u-tenants', title: 'Is either unit rented?', why: 'A tenant changes when you can move in and what you can charge.', resolver: 'listing_agent', action: 'email_listing_agent' },
    { id: 'u-bedrooms', title: 'How many bedrooms are there now?', why: 'Records leave bedrooms blank and one was turned into an office [8].', resolver: 'listing_agent', action: 'email_listing_agent' },
  ],
  sources: [
    { id: 'roll:2162008:2025', title: "Assessor's roll 2025, parcel 2162008", publisher: 'SF Assessor-Recorder', date: '2025-01-01', url: R + 'wv5m-vpq2.json?parcel_number=2162008&closed_roll_year=2025', dataset: 'wv5m-vpq2' },
    { id: 'permit:202301190427', title: 'Building permit 202301190427, ADU legalization', publisher: 'DBI', date: '2025-05-16', url: R + 'i98e-djp9.json?permit_number=202301190427', dataset: 'i98e-djp9' },
    { id: 'plumbing:PP20240724049', title: 'Plumbing permit PP20240724049, ADU baths', publisher: 'DBI', date: '2025-04-30', url: R + 'a6aw-rudh.json?permit_number=PP20240724049', dataset: 'a6aw-rudh' },
    { id: 'cfc:202301190427', title: 'Certificate of final completion, 2055A', publisher: 'DBI', date: '2025-05-16', url: R + 'j67f-aayr.json?building_permit_application=202301190427', dataset: 'j67f-aayr' },
    { id: 'plumbing:PP20240926192', title: 'Plumbing permit PP20240926192, upstairs baths', publisher: 'DBI', date: '2025-04-30', url: R + 'a6aw-rudh.json?permit_number=PP20240926192', dataset: 'a6aw-rudh' },
    { id: 'complaint:201488731', title: 'Complaint 201488731, illegal unit', publisher: 'DBI', date: '2014-08-05', url: R + 'gm2e-bten.json?complaint_number=201488731', dataset: 'gm2e-bten' },
    { id: 'planning:2022-007735ENF', title: 'Planning case 2022-007735ENF', publisher: 'SF Planning', date: '2022-07-11', url: 'https://sfplanninggis.org/pim?search=2022-007735ENF', dataset: 'y673-d69b' },
    { id: 'permit:202506047951', title: 'Building permit 202506047951, bedroom to office', publisher: 'DBI', date: '2025-07-08', url: R + 'i98e-djp9.json?permit_number=202506047951', dataset: 'i98e-djp9' },
    { id: 'permit:202502261145', title: 'Building permit 202502261145, reroof', publisher: 'DBI', date: '2025-03-06', url: R + 'i98e-djp9.json?permit_number=202502261145', dataset: 'i98e-djp9' },
    { id: 'electrical:2162008', title: 'Electrical permits, block 2162 lot 008', publisher: 'DBI', date: '2025', url: R + 'ftty-kx6y.json?block=2162&lot=008', dataset: 'ftty-kx6y' },
    { id: 'hazards:2162008', title: 'FEMA flood map and state seismic hazard zones', publisher: 'FEMA, California Geological Survey', date: '2021', url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28' },
    { id: 'tax:rate:2026-27', title: 'Tax rate resolution, FY 2026-27', publisher: 'Board of Supervisors', date: '2026-09-22', url: 'https://media.api.sf.gov/documents/r0524-26.pdf' },
    { id: 'tax:supplemental', title: 'Supplemental assessments', publisher: 'SF Assessor-Recorder', date: '2026', url: 'https://www.sf.gov/information--learn-about-supplemental-assessments' },
    { id: 'tax:transfer', title: 'Who pays what: California transfer taxes', publisher: 'Fidelity National Financial', date: '2026-01-06', url: 'https://page.fnf.com/rs/393-REY-847/images/Who%20Pays%20What%20-%20California%20Transfer%20Tax%20and%20Fees%20%28rev%2001062026%29.pdf' },
  ],
  actions: [],
  drafts: {
    listingAgentEmail: {
      to: null,
      subject: 'Questions about 2055 42nd Ave',
      body: "Hi,\n\nI'm interested in 2055 42nd Ave and have a few questions before making an offer.\n\n1. Is either unit currently rented? If so, what are the rents and lease terms?\n2. Could you share the floor plan? Public records don't list bedrooms, and a 2025 permit converted one to an office.\n3. Could you share the 3R report, the job cards for permits 202301190427 and 202408057968, and the certificate of final completion for 2055A?\n4. Do you know whether Planning has closed enforcement case 2022-007735ENF?\n\nThanks,\n",
      unknownIds: ['u-tenants', 'u-bedrooms'],
    },
    cityEmail: {
      to: 'pic@sfgov.org',
      subject: 'Status of enforcement case 2022-007735ENF, 2055 42nd Ave',
      body: "Hello,\n\nI'm considering buying 2055 42nd Ave (block 2162, lot 008). Planning case 2022-007735ENF still shows \"under review\" with an unauthorized unit noted. The unit was legalized under permit 202301190427, with a certificate of final completion issued May 16, 2025.\n\nCould you confirm whether the case is closed, or what remains open?\n\nThanks,\n",
      unknownIds: ['u-planning-case'],
    },
  },
};
