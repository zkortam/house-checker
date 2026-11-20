/**
 * House Checker contract: the ONLY code both Plan A (data + agent) and Plan B (UI) depend on.
 * Frozen at milestone M0. Any change is a PR reviewed by both leads, with fixtures updated in the same PR.
 * See plans/CONTRACT.md for the rules this file encodes.
 */

/* ---------- Identity ---------- */

export type ReportId = string;          // url-safe, e.g. "2055-42nd-ave-k3f9"
export type SourceId = string;          // stable within a report, e.g. "permit:202301190427"
export type UnknownId = string;         // stable within a report, e.g. "u-planning-case"

/* ---------- Labels: one vocabulary, display text lives in labels.ts ---------- */

export type FindingLabel =
  | 'matches'                 // Matches records
  | 'matches_planning'        // Matches Planning records
  | 'permitted_not_updated'   // Permitted, assessor not updated
  | 'permitted_not_finaled'   // Permitted, not finaled
  | 'no_permit_found'         // No permit found
  | 'records_differ'          // Records differ from listing
  | 'records_disagree'        // Records disagree (two city sources conflict)
  | 'open_case'               // Open city case
  | 'likely_stale'            // Likely stale (an open record contradicted by a newer one)
  | 'resolved'                // Resolved
  | 'not_settled';            // Records don't settle this

export type Tone = 'success' | 'info' | 'warning' | 'error' | 'neutral';

/** Glyph keys. Plan B maps each to exactly one icon (one glyph per concept). */
export type Glyph =
  | 'parcel' | 'roll' | 'permit' | 'plumbing' | 'electrical' | 'complaint' | 'violation' | 'planning'
  | 'hazard' | 'money' | 'tenants' | 'zoning' | 'grow' | 'nearby' | 'roof' | 'foundation' | 'unknown'
  | 'resolved' | 'warning' | 'packet' | 'reservoir' | 'landslide' | 'flood';

/* ---------- Text with citations ---------- */

/**
 * Model- or rule-written prose. May contain citation markers "[n]" where n is the 1-based index into
 * Report.sources. Plain text only, no markdown. Must pass copy rules (copy.ts: checkCopy).
 */
export type CitedText = string;

/* ---------- Sources ---------- */

export interface Source {
  id: SourceId;
  title: string;            // "Building permit 202301190427, ADU legalization"
  publisher: string;        // "DBI", "SF Planning", "SF Assessor-Recorder", "FEMA"
  date: string | null;      // ISO date "2025-05-16", or "2025" / "2025-05" when that is all that is known
  url: string | null;       // exact record link; null when no safe link exists (rendered as plain text)
  dataset?: string;         // DataSF id, e.g. "i98e-djp9"
  page?: number;            // 1-based page, only for disclosure-packet sources (id "packet:<fileId>:p<n>", url null)
}

/* ---------- Report sections ---------- */

export type SectionKey =
  | 'ledger' | 'cases' | 'costs' | 'systems' | 'tenants' | 'upside' | 'hazards' | 'nearby' | 'history' | 'unknowns' | 'packet';

/** Every section is in exactly one state. An error is never rendered as empty. */
export type SectionState =
  | { state: 'ok' }
  | { state: 'empty'; text: string }                       // e.g. "No open city cases"
  | { state: 'error'; source: string; retryable: boolean }; // e.g. source "DBI complaints"

export interface ClaimRow {
  key: 'units' | 'baths' | 'beds' | 'sqft' | 'adu' | 'renovation' | 'other';
  title: string;            // "Units"
  listing: string | null;   // what the listing says, short (at most 14 characters): "4", "Legal", "2,000"
  records: string | null;   // what the city says, short (at most 14 characters): "4", "None", "1,900 to 2,745"; null renders as EMPTY_VALUE
  label: FindingLabel;
  why: CitedText;           // shown when the row expands
}

export interface CaseRow {
  glyph: Glyph;
  title: string;
  text: CitedText;
  label: FindingLabel;      // usually open_case or likely_stale
  stake?: CitedText;        // dollars or consequence, e.g. "$152 a month while open [12]"
}

export interface InfoRow {
  glyph: Glyph;
  title: string;
  text: CitedText;
  muted?: boolean;          // "No permit on record" style rows
}

export type HistoryKind = 'permit' | 'complaint' | 'planning' | 'sale' | 'tenant' | 'other';

export interface HistoryRow {
  date: string;             // ISO "2025-05-16", "2022-02" or "2017"
  kind: HistoryKind;        // sets the timeline dot: permit info, complaint error, planning warning, sale neutral, tenant warning
  text: CitedText;          // short: "In-law legalized [4]"
}

/* ---------- Visual summary (the top of the report; plain words, no jargon) ---------- */

/** Six tiles at the top of the report. Tapping one scrolls to its section. */
export interface GlanceTile {
  section: SectionKey;      // 'ledger' | 'cases' | 'costs' | 'tenants' | 'hazards' | 'upside'
  glyph: Glyph;
  label: string;            // "Legal units"
  value: string | null;     // big text: "2", "1", "Buyout 2020". For section 'costs' Plan B fills it from costs.rows (property tax per month)
  tone: Tone;
  status: string;           // short plain status beside a dot: "Matches listing", "Probably outdated"
}

/** One building system as a tile: big year of the last permitted work. */
export interface SystemRow {
  glyph: Glyph;
  title: string;            // "Roof"
  year: number | null;      // last permitted work; null renders as EMPTY_VALUE
  status: 'updated' | 'in_progress' | 'old' | 'no_record';
  text: CitedText;          // shown on tap: "Reroofed, permit complete Mar 6, 2025 [9]"
}

/** One line of the hazard checklist. */
export interface HazardCheck {
  key: 'flood' | 'storm_flood' | 'liquefaction' | 'landslide' | 'tsunami' | 'sea_level' | 'reservoir' | 'soil';
  title: string;            // "Flood"
  status: 'clear' | 'note' | 'unknown';
  text: CitedText;          // "FEMA zone X [11]" or "Inside the Sunset reservoirs' failure zone [17]"
}

export type CostKind = 'property_tax' | 'supplemental_tax' | 'transfer_tax' | 'case_fees' | 'repair_estimate' | 'insurance_estimate';

export interface CostRow {
  kind: CostKind;
  title: string;
  amount: number | null;    // USD; null renders as the empty glyph
  per: 'once' | 'year' | 'month';
  estimate: boolean;        // true for ranges from vendor or rough sources
  text: CitedText;
}

export interface Costs {
  price: number;            // asking price, or the buyer's own number
  assessedValue: number | null;
  rows: CostRow[];          // computed by money.ts from price + inputs; Plan B recomputes on price edit
  inputs: MoneyInputs;
}

export interface MoneyInputs {
  assessedValue: number | null;
  ownerOccupied: boolean;
  melloRoosPerSqft: number | null;
  sqft: number | null;
  openCaseMonthlyFee: number | null;   // e.g. 152 when DBI monitoring applies
  sourceIndex: { taxRate: number; supplemental: number; transferTax: number; caseFees?: number }; // 1-based into sources
}

export type ActionKind = 'email_listing_agent' | 'email_city' | 'book_specialist' | 'agent_brief' | 'none';

export interface Unknown {
  id: UnknownId;
  title: string;            // "Is the Planning case closed?"
  why: CitedText;           // one sentence: why it matters
  resolver: 'listing_agent' | 'city' | 'specialist' | 'buyer_agent';
  action: ActionKind;
  specialist?: string;      // "structural engineer" when action = book_specialist
}

export interface ActionLogEntry {
  id: string;
  kind: ActionKind;
  unknownIds: UnknownId[];
  at: string;               // ISO datetime
  summary: string;          // "Emailed the listing agent", "Booked a structural engineer for Tue, Dec 1, 9:00 AM"
  to?: string;
}

export interface Decision {
  tone: 'clear' | 'caution' | 'stop';   // clear = success, caution = warning, stop = error
  title: string;            // plain verdict, at most 6 words: "Looks solid", "Get it checked before you offer"
  inspection: CitedText;    // one sentence on what inspection is needed, if any
}

export interface Report {
  id: ReportId;
  version: 1;
  createdAt: string;        // ISO
  checkedAt: string;        // ISO, when the records were read
  address: string;          // "2055 42nd Ave"
  parcels: string[];        // ["2162008"]
  parcelDisplay: string;    // "2162-008"
  meta: { zoning: string | null; neighborhood: string | null; yearBuilt: number | null; lotSqft: number | null };
  listing: { text: string; claims: ListingClaims };
  answer: CitedText;        // the short answer under the verdict: 1 or 2 short sentences, at most 220 characters
  answerBy?: 'ai' | 'rules'; // who wrote answer and decision.inspection: the Claude CLI, or the rule templates (CLI off or failed). Absent = 'ai'
  decision: Decision;
  glance: GlanceTile[];     // exactly 6, in this order: ledger, cases, costs, tenants, hazards, upside
  highlights: { good: CitedText[]; watch: CitedText[] };  // 2 to 5 each, one short line each (at most 90 characters)
  sections: Record<SectionKey, SectionState>;
  ledger: ClaimRow[];
  cases: CaseRow[];
  costs: Costs;
  systems: SystemRow[];
  tenants: InfoRow[];
  upside: InfoRow[];
  hazards: HazardCheck[];
  nearby: InfoRow[];
  history: HistoryRow[];
  unknowns: Unknown[];
  sources: Source[];
  actions: ActionLogEntry[];
  drafts: { listingAgentEmail: EmailDraft | null; cityEmail: EmailDraft | null };
  packet?: PacketSummary | null; // present only when a disclosure packet was added
}

/* ---------- Disclosure packet (optional; A12) ---------- */

export type PacketDoc = 'inspection' | 'pest' | 'tds' | 'spq' | '3r' | 'nhd' | 'title' | 'hoa' | 'other';

/** One thing the disclosure packet states, compared with city records. */
export interface PacketFinding {
  doc: PacketDoc;           // which document in the packet
  topic: 'units' | 'baths' | 'beds' | 'sqft' | 'roof' | 'foundation' | 'permits' | 'other';
  statement: string;        // short plain paraphrase of what the packet says, at most 90 characters: "3 bathrooms"
  page: number;             // 1-based page in the uploaded PDF
  label: FindingLabel;      // vs city records: matches | records_differ | not_settled (code decides)
  records: string | null;   // what the city says, at most 14 characters; null renders EMPTY_VALUE
  text: CitedText;          // "The packet states 3 bathrooms on page 1 [23]. City records show 4 [3][5]."
}

export interface PacketSummary {
  fileName: string | null;  // as uploaded
  pages: number;
  findings: PacketFinding[]; // may be empty; then sections.packet is { state: 'empty', text }
}

export interface ListingClaims {
  address: string | null;
  price: number | null;
  units: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  adu: 'legal' | 'claimed' | null;
  renovations: string[];
}

export interface EmailDraft {
  to: string | null;        // listing agent address if the listing text had one
  subject: string;
  body: string;             // the buyer's own voice; "I" is allowed here
  unknownIds: UnknownId[];
}

/* ---------- Stream: POST /api/check -> text/event-stream ---------- */

export interface CheckRequest {
  listingText: string;
  packetFileId?: string;    // from POST /api/packet (Plan A), optional
}

export type StepStatus = 'running' | 'done' | 'failed';

export interface StepEvent {
  type: 'step';
  id: string;               // stable per run: "parcel" | "roll" | "permits" | "trade_permits" | "complaints" | "planning" | "zoning" | "money" | "tenants" | "nearby" | "hazards" | "packet"
  glyph: Glyph;
  title: string;            // "Read building permits"
  status: StepStatus;
  detail?: string;          // live and real: "Read 12 of 31 permits", then "31 permits"
  reason?: string;          // when failed: "Couldn't reach DBI permits"
  retryable?: boolean;
  count?: { done: number; total: number }; // real progress for a running step, e.g. permits read 200 of 302
}

/** One JSON object per `data:` line. A stream that ends before `done` is a failed run, never a short one. */
export type StreamEvent =
  | { type: 'run'; runId: string; reportId: ReportId; address: string }
  | StepEvent
  | { type: 'progress'; text: string }       // shown only while no step is running
  | { type: 'delta'; text: string }          // the short answer as it is written
  | { type: 'report'; report: Report }       // the complete report, once
  | { type: 'done' }
  | { type: 'error'; error: ApiError };

/* ---------- Errors: Plan B maps kind to copy; never shows message to the reader ---------- */

export type ApiErrorKind = 'invalid' | 'outside_sf' | 'not_found' | 'offline' | 'timeout' | 'unavailable' | 'rate' | 'refused';

export interface ApiError {
  kind: ApiErrorKind;
  retryable: boolean;
  retryAfterSec?: number;
  reference?: string;       // for unavailable: shown as "Reference 7F3K2Q9A"
  field?: 'listingText' | 'to' | 'slot';
  debug?: string;           // logs only, never rendered
}

/* ---------- Other endpoints (all JSON) ---------- */

// GET  /api/check/:id                 -> Report | ApiError(not_found)
// POST /api/actions/email             EmailSendRequest -> ActionResult
// GET  /api/slots?report=&unknown=    -> SlotOffer
// POST /api/actions/book              BookRequest -> ActionResult
// POST /api/packet (multipart, PDF)   -> { packetFileId: string }

export interface EmailSendRequest {
  reportId: ReportId;
  unknownIds: UnknownId[];
  kind: 'email_listing_agent' | 'email_city';
  to: string;
  subject: string;
  body: string;
  idempotencyKey: string;   // client-generated; the server sends at most once per key
}

export interface SlotOffer {
  provider: string;         // "Example structural engineer"
  specialist: string;       // "structural engineer"
  scope: string;            // what the visit covers, from the findings
  priceUsd: number | null;
  paidPlacement: false;     // always false; rendered as "No paid placement"
  slots: string[];          // ISO datetimes
}

export interface BookRequest {
  reportId: ReportId;
  unknownId: UnknownId;
  slot: string;
  idempotencyKey: string;
}

export type ActionResult = { ok: true; entry: ActionLogEntry } | { ok: false; error: ApiError };
