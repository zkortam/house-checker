# Plan A: data, rules and the agent

**Goal:** turn pasted listing text into a complete, cited `Report` (see `src/contract/types.ts`), streamed as it
is built, and carry out the actions the buyer approves. Plan A never renders UI; Plan B never fetches city data.

**Owns:** `app/api/**`, `src/server/**`, `tests/server/**`, `.env.example`. Reads `research/data.md` (query plan),
`research/money.md`, `research/market-legal.md`, `research/buyer-needs.md`.

**Model:** Claude via `@anthropic-ai/sdk`, model `claude-opus-5-5`. Structured outputs (`output_config.format`)
for every extraction. Effort `low` for parsing and permit reading, `medium` for explanations. Server-side refusal
fallbacks on (`fallbacks: "default"`). Check `stop_reason` before reading content. Cache the system prompts.

## Work items

| # | Item | Output | Done when |
|---|---|---|---|
| A1 | **Listing parser.** Claude reads the pasted text into `ListingClaims`; reject non-SF addresses (`outside_sf`) | `listing` | 10 sample listings parse; a Berkeley address returns `outside_sf` |
| A2 | **Parcel resolver.** Address file `ramy-di5m` → every parcel on the base address, suffix units, lat/lon; lot lineage `nqyt-nfmd`; never split parcel numbers by position | `parcels`, `parcelDisplay`, step `parcel` | All 6 demo addresses resolve; a condo address returns all its parcels |
| A3 | **Fetchers.** One module per source from the query plan in `research/data.md`: assessor, building permits (dedupe by number), PermitSF, plumbing, electrical, inspections, unit certificates, Housing Production, complaints, notices of violation, Planning, soft-story, zoning and lot, nearby projects within 150 m, hazards (FEMA, CGS, SFPUC). Run in parallel. 8 s timeout, one jittered retry, 24 h cache. Each emits `step` events with real counts ("Read 12 of 31 permits") | Raw records + steps | A forced timeout yields a `failed` step and `sections[key].state = 'error'` while the rest completes |
| A4 | **Normalize.** Every record becomes a `Source` with a stable id (`permit:202301190427`) and the exact record URL | `sources` | Every source URL opens the record |
| A5 | **Permit reader.** Claude, structured output, over permit descriptions only: adds baths, adds or removes units, legalizes a unit, garage conversion, cites a notice of violation, rewire, sewer lateral, foundation, reroof | Per-permit facts tied to source ids | Correct on the permits of the 6 demo addresses |
| A6 | **Rules (deterministic, no model).** Unit timeline from completed unit-changing permits, then certificates, then Housing Production; bath count from finaled plumbing permits; lien-date lag; every `FindingLabel` per the rules in `research/data.md`; open and likely-stale cases; units that disappeared (merger); bones from permit history; rent-control screen (year built before 6/13/1979 and 2+ units); SB 9 and ADU screen (zoning, lot size, tenancy); historic status | `ledger`, `cases`, `bones`, `tenants`, `upside`, `around`, `history`, `sections` | Labels for the fixture listing equal the fixture's |
| A7 | **Money inputs.** Assessed value from the roll, owner-occupied default, Mello-Roos district flag, open-case monthly fee; then `computeCosts` from the contract | `costs` | Matches the fixture's rows for the fixture inputs |
| A8 | **Unknowns and decision.** For each open question, the cheapest resolver (listing agent, city, specialist, buyer's agent). A specialist only when no document or record can settle it. Decision tone `clear`, `caution` or `stop` | `unknowns`, `decision` | 2055 42nd Ave proposes no specialist; 57 Carmelita St proposes a structural engineer |
| A9 | **Writer.** Claude writes `answer`, `decision.text`, every `why`, `text` and both email drafts, citing only `[n]` from the sources. Validate with `checkCopy` and `checkCitations`, and reject any number not present in the evidence; retry once, then fall back to the rule's own sentence | Prose fields, `drafts` | No uncited claim and no copy violation across the 6 demo addresses |
| A10 | **Stream and store.** `POST /api/check` streams `StreamEvent`s in contract order; the report is stored (KV) by id; `GET /api/check/[id]` returns it | Routes | `tests/contract/stream-order` and `labels-parity` pass |
| A11 | **Actions.** Email via Resend (or Gmail API), at most once per `idempotencyKey`; slots and booking via Cal.com with a demo specialist account; append `ActionLogEntry` to the stored report | `/api/actions/*`, `/api/slots` | A real email lands; a real booking appears on the calendar; a repeated key sends nothing |
| A12 | **Disclosure packet (stretch).** `POST /api/packet` stores the PDF; Claude reads the inspection, pest, TDS/SPQ, 3R, NHD, preliminary title and HOA documents and adds reconciliation rows and a `packet` section | `packet` section, extra ledger rows | A sample packet produces at least one reconciled claim with a page citation |

## Rules Plan A must keep

- Code decides every label and every number; the model reads permit text and writes sentences. The model never
  invents a record, a label or a figure.
- Labels say what the records show. Never "illegal" or "misrepresented" about a listing. Legal consequences
  (rent control, §317, SB 9) are screening flags that end with who can confirm them.
- No crime, school or demographic data (fair housing). No tenant identities.
- A failure is never an empty section. A null value is `null`, never `0` or `""`.
- All copy passes `checkCopy`. Drafted emails are the buyer's voice ("I" is fine there).

## Demo addresses Plan A records (cache warm-up and tests)

2055 42nd Ave, 57 Carmelita St, 1665 North Point St, 998 Burnett Ave, 63 Jules Ave, 686 Colby St (control).
Record their raw responses under `tests/server/recordings/` so tests run offline.
