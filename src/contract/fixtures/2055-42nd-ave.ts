import type { MoneyInputs, Report, StepEvent } from '../types';
import { computeCosts } from '../money';

/**
 * Golden fixture. Real City records (DataSF, checked 2026-11-20); the listing text is an example.
 * Plan B renders it; Plan A's pipeline must produce an equivalent Report for the same listing text
 * (same labels per ledger row, same open cases, same source ids). Changing it is a contract change.
 * Never put personal names from city records in a fixture (business registrations carry them).
 */
const R = 'https://data.sf.gov/resource/';
const D = 'https://data.sf.gov/d/';

const inputs: MoneyInputs = {
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
  { type: 'step', id: 'tenants', glyph: 'tenants', title: 'Read tenant buyouts and business registrations', status: 'done', detail: '1 buyout, 1 hotel-tax registration' },
  { type: 'step', id: 'hazards', glyph: 'hazard', title: 'Checked hazard zones', status: 'done', detail: '8 maps, 1 zone' },
  { type: 'step', id: 'nearby', glyph: 'nearby', title: 'Read projects nearby', status: 'done', detail: '1 project within 150 m' },
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
  answer: 'A legal two-unit home. The in-law was legalized and signed off in 2025 [2][4], so the assessor still showing one unit and one bath is out of date [1].',
  decision: {
    tone: 'clear',
    title: 'Looks solid',
    inspection: 'A standard inspection covering both units is enough. Ask the inspector to look at the foundation and sewer lateral too.',
  },
  glance: [
    { section: 'ledger', glyph: 'parcel', label: 'Legal units', value: '2', tone: 'success', status: 'Matches listing' },
    { section: 'cases', glyph: 'planning', label: 'Open city cases', value: '1', tone: 'warning', status: 'Probably outdated' },
    { section: 'costs', glyph: 'money', label: 'Property tax', value: null, tone: 'neutral', status: 'A month at asking' },
    { section: 'tenants', glyph: 'tenants', label: 'Tenants', value: 'Buyout 2020', tone: 'warning', status: 'Rent rules likely' },
    { section: 'hazards', glyph: 'reservoir', label: 'Hazards', value: '1 of 8', tone: 'warning', status: 'Reservoir zone' },
    { section: 'upside', glyph: 'grow', label: 'Room to grow', value: 'Lot split', tone: 'info', status: 'Check SB 9 rules' },
  ],
  highlights: {
    good: [
      'In-law legalized and signed off in 2025 [2][4]',
      'Four baths have plumbing finals [3][5]',
      'New roof in 2025 [9]',
      'Outside FEMA flood zones [11]',
    ],
    watch: [
      'Planning case still reads under review [7]',
      'Tenant buyout in 2020: $75,000 to 3 tenants [15]',
      'Hotel-tax registration since 2023, a sign of short-term rentals [16]',
      'Inside the Sunset reservoirs failure zone [17]',
      'A demolition and new 2-unit building planned nearby [18]',
    ],
  },
  sections: {
    ledger: { state: 'ok' }, cases: { state: 'ok' }, costs: { state: 'ok' }, systems: { state: 'ok' }, tenants: { state: 'ok' },
    upside: { state: 'ok' }, hazards: { state: 'ok' }, nearby: { state: 'ok' }, history: { state: 'ok' }, unknowns: { state: 'ok' },
    packet: { state: 'empty', text: 'No disclosure packet added' },
  },
  ledger: [
    { key: 'units', title: 'Units', listing: '2', records: '2', label: 'permitted_not_updated',
      why: "Permit 202301190427 legalized the ground-floor unit under the ADU program and closed with a certificate of final completion on May 16, 2025 [2][4]. The assessor's roll is a snapshot from Jan 1, 2025, before that work finished [1]." },
    { key: 'baths', title: 'Baths', listing: '4', records: '4', label: 'permitted_not_updated',
      why: 'Two plumbing permits passed final inspection on Apr 30, 2025: two baths in the ADU and two new baths upstairs [3][5]. The assessor still records 1 bath [1].' },
    { key: 'sqft', title: 'Sq ft', listing: '2,000', records: '2,006', label: 'matches_planning',
      why: "Planning approved the ADU project at 2,006 sq ft of floor area, up from 1,216 [7]. The assessor's 1,300 predates the work [1]." },
    { key: 'adu', title: 'In-law', listing: 'Legal', records: 'Legal 2025', label: 'resolved',
      why: 'Complaints in 2014, 2017 and 2018 cited an illegal unit with no windows or ventilation in the bedroom [6]. The 2023 permit was filed to comply with both notices of violation and is complete [2].' },
    { key: 'beds', title: 'Bedrooms', listing: '3', records: null, label: 'not_settled',
      why: 'The assessor leaves bedrooms blank for this parcel. A 2025 permit converted one upstairs bedroom to an office [8]. Ask for the floor plan.' },
  ],
  cases: [
    { glyph: 'planning', title: 'Planning enforcement case still "under review"', label: 'likely_stale',
      text: 'Case 2022-007735ENF, opened Jul 11, 2022, notes an unauthorized unit. The unit was certified in 2025, so this is probably outdated [7][4].' },
  ],
  costs: { price: 1_595_000, assessedValue: 1_483_566, inputs, rows: computeCosts(1_595_000, inputs, new Date('2026-12-01T12:00:00Z')) },
  systems: [
    { glyph: 'plumbing', title: 'Plumbing', year: 2025, status: 'updated', text: 'Both units replumbed for new baths and kitchens, final Apr 30, 2025 [3][5]' },
    { glyph: 'roof', title: 'Roof', year: 2025, status: 'updated', text: 'Reroofed, permit complete Mar 6, 2025 [9]' },
    { glyph: 'electrical', title: 'Wiring', year: 2025, status: 'updated', text: 'Electrical permits filed with the 2024 remodel, complete [10]' },
    { glyph: 'foundation', title: 'Foundation', year: null, status: 'no_record', text: 'No permit on record. Built 1947, so ask the inspector to look at it.' },
    { glyph: 'plumbing', title: 'Sewer lateral', year: null, status: 'no_record', text: 'No permit on record. A camera inspection costs a few hundred dollars and is worth it for a 1947 house.' },
  ],
  tenants: [
    { glyph: 'tenants', title: 'Tenant buyout in 2020', text: 'Buyout B200136, filed Apr 8, 2020: $75,000 paid to 3 tenants to leave [15]. A past buyout can limit converting the units to condos later. Ask the Rent Board how it applies.' },
    { glyph: 'money', title: 'Short-term rental signal', text: 'A business at this address has been registered for hotel tax since Aug 4, 2023 [16]. That usually means short-term rentals. Ask whether any bookings run past closing.' },
    { glyph: 'tenants', title: 'Rent control', text: 'Two units in a building from 1947. Units like these are usually covered by eviction protections, and often by rent limits. Confirm with the Rent Board before you plan to move in or rent out.' },
    { glyph: 'complaint', title: 'Tenants now', text: 'Not in public records. The 2014 complaint described a renter in the garage unit [6]. Ask whether either unit is occupied.' },
  ],
  upside: [
    { glyph: 'zoning', title: 'Zoning RH-1', text: 'Residential, one-family district. The legalized ADU is the second unit.' },
    { glyph: 'grow', title: 'Lot 2,996 sq ft', text: 'Above the 2,400 sq ft minimum for an SB 9 lot split. SB 9 is off the table if a unit was rented in the last 3 years [1].' },
  ],
  hazards: [
    { key: 'flood', title: 'Flood', status: 'clear', text: 'FEMA zone X, minimal flood hazard [11]' },
    { key: 'storm_flood', title: 'Storm flooding', status: 'clear', text: "Outside the city's 100-year storm flood zone [19]" },
    { key: 'liquefaction', title: 'Liquefaction', status: 'clear', text: 'Outside the state liquefaction zone [11]' },
    { key: 'landslide', title: 'Landslide', status: 'clear', text: 'Outside the state landslide zone [11]' },
    { key: 'tsunami', title: 'Tsunami', status: 'clear', text: 'Outside the tsunami hazard area [11]' },
    { key: 'sea_level', title: 'Sea level rise', status: 'clear', text: 'Outside the sea level rise maps, even with 66 inches of rise [20]' },
    { key: 'reservoir', title: 'Reservoir', status: 'note', text: "Inside the Sunset North and Sunset South reservoirs' failure zones [17]. Ask your insurer whether it changes the quote." },
    { key: 'soil', title: 'Soil', status: 'clear', text: 'Outside the Maher soil testing area [21]' },
  ],
  nearby: [
    { glyph: 'nearby', title: '3327 Quintara St', text: 'Full demolition and a new 3-story, 2-unit building. Project 2026-008730PRJ was submitted Oct 2, 2026, within 150 m [18].' },
  ],
  history: [
    { date: '2014-08-05', kind: 'complaint', text: 'Complaint: illegal unit in the garage [6]' },
    { date: '2017', kind: 'complaint', text: 'Second notice of violation for the same unit [6]' },
    { date: '2020-04-08', kind: 'tenant', text: 'Tenant buyout, 3 tenants [15]' },
    { date: '2022-02', kind: 'sale', text: 'Current owner bought the house [1]' },
    { date: '2022-07-11', kind: 'planning', text: 'Planning opens case 2022-007735ENF [7]' },
    { date: '2023-08-04', kind: 'other', text: 'Hotel-tax registration starts [16]' },
    { date: '2025-03-06', kind: 'permit', text: 'Reroof complete [9]' },
    { date: '2025-04-30', kind: 'permit', text: 'Plumbing finals for four baths [3]' },
    { date: '2025-05-16', kind: 'permit', text: 'In-law legalized, certificate issued [4]' },
    { date: '2025-07-08', kind: 'permit', text: 'Upstairs bedroom converted to an office [8]' },
  ],
  unknowns: [
    { id: 'u-planning-case', title: 'Is the Planning case closed?', why: 'Case 2022-007735ENF still reads "under review". A clean close-out protects resale [7].', resolver: 'city', action: 'email_city' },
    { id: 'u-tenants', title: 'Is either unit rented?', why: 'A tenant changes when you can move in and what you can charge.', resolver: 'listing_agent', action: 'email_listing_agent' },
    { id: 'u-short-term', title: 'Are short-term rentals booked?', why: 'A hotel-tax registration has been active since 2023 [16]. Bookings past closing become your problem.', resolver: 'listing_agent', action: 'email_listing_agent' },
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
    { id: 'hazards:2162008', title: 'FEMA flood map, state seismic hazard and tsunami zones', publisher: 'FEMA, California Geological Survey', date: '2021', url: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28' },
    { id: 'tax:rate:2026-27', title: 'Tax rate resolution, FY 2026-27', publisher: 'Board of Supervisors', date: '2026-09-22', url: 'https://media.api.sf.gov/documents/r0524-26.pdf' },
    { id: 'tax:supplemental', title: 'Supplemental assessments', publisher: 'SF Assessor-Recorder', date: '2026', url: 'https://www.sf.gov/information--learn-about-supplemental-assessments' },
    { id: 'tax:transfer', title: 'Who pays what: California transfer taxes', publisher: 'Fidelity National Financial', date: '2026-01-06', url: 'https://page.fnf.com/rs/393-REY-847/images/Who%20Pays%20What%20-%20California%20Transfer%20Tax%20and%20Fees%20%28rev%2001062026%29.pdf' },
    { id: 'buyout:B200136', title: 'Tenant buyout declaration B200136', publisher: 'SF Rent Board', date: '2020-04-08', url: R + 'wmam-7g8d.json?$where=' + encodeURIComponent("upper(address) like '2055 42ND%'"), dataset: 'wmam-7g8d' },
    { id: 'business:hotel-tax:2055-42nd', title: 'Registered businesses with hotel tax, 2055 42nd Ave', publisher: 'SF Treasurer and Tax Collector', date: '2023-08-04', url: D + 'g8m3-pdis', dataset: 'g8m3-pdis' },
    { id: 'reservoir:2162008', title: 'Reservoir failure inundation zones', publisher: 'SFPUC', date: null, url: D + '7crf-46s6', dataset: '7crf-46s6' },
    { id: 'planning:2026-008730PRJ', title: 'Planning project 2026-008730PRJ, 3327 Quintara St', publisher: 'SF Planning', date: '2026-10-02', url: R + 'qvu5-m3a2.json?record_id=2026-008730PRJ', dataset: 'qvu5-m3a2' },
    { id: 'stormflood:2162008', title: '100-year storm flood risk zone', publisher: 'SFPUC', date: '2022-07', url: D + 'jzu3-4yxp', dataset: 'jzu3-4yxp' },
    { id: 'sealevel:2162008', title: 'Sea level rise maps, 24 and 66 inches', publisher: 'SF Planning', date: '2020', url: D + 'esku-ejgv', dataset: 'esku-ejgv' },
    { id: 'maher:2162008', title: 'Maher soil and groundwater ordinance area', publisher: 'SF Public Health', date: null, url: D + 'v5ic-hjgw', dataset: 'v5ic-hjgw' },
  ],
  actions: [],
  drafts: {
    listingAgentEmail: {
      to: null,
      subject: 'Questions about 2055 42nd Ave',
      body: "Hi,\n\nI'm interested in 2055 42nd Ave and have a few questions before making an offer.\n\n1. Is either unit currently rented? If so, what are the rents and lease terms?\n2. City records show a hotel-tax registration at this address since 2023. Are any short-term rental bookings scheduled after closing?\n3. Could you share the floor plan? Public records don't list bedrooms, and a 2025 permit converted one to an office.\n4. Could you share the 3R report, the job cards for permits 202301190427 and 202408057968, and the certificate of final completion for 2055A?\n5. Do you know whether Planning has closed enforcement case 2022-007735ENF?\n\nThanks,\n",
      unknownIds: ['u-tenants', 'u-short-term', 'u-bedrooms'],
    },
    cityEmail: {
      to: 'pic@sfgov.org',
      subject: 'Status of enforcement case 2022-007735ENF, 2055 42nd Ave',
      body: "Hello,\n\nI'm considering buying 2055 42nd Ave (block 2162, lot 008). Planning case 2022-007735ENF still shows \"under review\" with an unauthorized unit noted. The unit was legalized under permit 202301190427, with a certificate of final completion issued May 16, 2025.\n\nCould you confirm whether the case is closed, or what remains open?\n\nThanks,\n",
      unknownIds: ['u-planning-case'],
    },
  },
};
