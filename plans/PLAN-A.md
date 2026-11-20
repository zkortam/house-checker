# Plan A: data, rules and the agent

**Goal:** turn pasted listing text into a complete, cited `Report` (see `src/contract/types.ts`), streamed as it
is built, and carry out the actions the buyer approves. Plan A never renders UI; Plan B never fetches city data.

**Owns:** `app/api/**`, `src/server/**`, `tests/server/**`, `.env.example`. Reads `research/data.md` (query plan),
`research/money.md`, `research/market-legal.md`, `research/buyer-needs.md`.

**Model: the local Claude Code CLI, no API key and no Anthropic API.** `src/server/llm.ts` spawns
`$CLAUDE_BIN -p --output-format json --no-session-persistence --json-schema '<schema json>' --tools "" -- "<prompt>"`
(the prompt goes after `--`) and parses stdout JSON (structured result in `structured_output`, else `result`;
verify the field by running it once). Timeout per call, one retry, at most 3 concurrent calls, and a
deterministic template fallback for every call so a report is complete even when the CLI is missing or fails.

**Storage:** JSON files under `.data/` (gitignored): `.data/reports/<id>.json`, `.data/cache/` (24 h per query),
`.data/outbox/` (emails when Resend is not configured), `.data/sent/` (idempotency keys). No external database.

## Work items

| # | Item | Output | Done when |
|---|---|---|---|
| A1 | **Listing parser.** Claude reads the pasted text into `ListingClaims`; reject non-SF addresses (`outside_sf`) | `listing` | 10 sample listings parse; a Berkeley address returns `outside_sf` |
| A2 | **Parcel resolver.** Address file `ramy-di5m` → every parcel on the base address, suffix units, lat/lon; lot lineage `nqyt-nfmd`; never split parcel numbers by position | `parcels`, `parcelDisplay`, step `parcel` | All 6 demo addresses resolve; a condo address returns all its parcels |
| A3 | **Fetchers.** One module per source from the query plan in `research/data.md`: assessor, building permits (dedupe by number), PermitSF, plumbing, electrical, inspections, unit certificates, Housing Production, complaints, notices of violation, Planning, soft-story, zoning and lot, nearby projects within 150 m, hazards (FEMA, CGS, SFPUC). Run in parallel. 8 s timeout, one jittered retry, 24 h cache. Each emits `step` events with real counts ("Read 12 of 31 permits") | Raw records + steps | A forced timeout yields a `failed` step and `sections[key].state = 'error'` while the rest completes |
| A4 | **Normalize.** Every record becomes a `Source` with a stable id (`permit:202301190427`) and the exact record URL | `sources` | Every source URL opens the record |
| A5 | **Permit reader.** Claude, structured output, over permit descriptions only: adds baths, adds or removes units, legalizes a unit, garage conversion, cites a notice of violation, rewire, sewer lateral, foundation, reroof | Per-permit facts tied to source ids | Correct on the permits of the 6 demo addresses |
| A6 | **Rules (deterministic, no model).** Unit timeline from completed unit-changing permits, then certificates, then Housing Production; bath count from finaled plumbing permits; lien-date lag; every `FindingLabel` per the rules in `research/data.md`; open and likely-stale cases; units that disappeared (merger); `systems` year tiles from permit history; rent-control screen (year built before 6/13/1979 and 2+ units); tenant buyouts (`wmam-7g8d`) and hotel-tax business registrations (`g8m3-pdis`, short-term rental signal, never names, link the dataset page); SB 9 and ADU screen; historic status; the 8-line `hazards` checklist (FEMA, storm flood, liquefaction, landslide class `bna4-itif`, tsunami, sea level, reservoir failure `7crf-46s6`, Maher soil); `nearby` Planning projects within 150 m (`qvu5-m3a2`); `history` rows with a `kind`; the 6 `glance` tiles and 2 to 5 `highlights` each side (see research/sweep.md) | `ledger`, `cases`, `systems`, `tenants`, `upside`, `hazards`, `nearby`, `history`, `glance`, `highlights`, `sections` | Labels for the fixture listing equal the fixture's; 57 Carmelita St matches its fixture's labels too |
| A7 | **Money inputs.** Assessed value from the roll, owner-occupied default, Mello-Roos district flag, open-case monthly fee; then `computeCosts` from the contract | `costs` | Matches the fixture's rows for the fixture inputs |
| A8 | **Unknowns and decision.** For each open question, the cheapest resolver (listing agent, city, specialist, buyer's agent). A specialist only when no document or record can settle it. Decision tone `clear`, `caution` or `stop`, a plain title of at most 6 words ("Looks solid") and one `inspection` sentence | `unknowns`, `decision` | 2055 42nd Ave proposes no specialist; 57 Carmelita St proposes a structural engineer |
| A9 | **Writer.** The Claude Code CLI (via `src/server/llm.ts`) writes `answer`, `decision.inspection`, `highlights`, every `why`, `text` and both email drafts, citing only `[n]` from the sources. Validate with `checkCopy` and `checkCitations`, and reject any number not present in the evidence; retry once, then fall back to the rule's own sentence | Prose fields, `drafts` | No uncited claim and no copy violation across the 6 demo addresses |
| A10 | **Stream and store.** `POST /api/check` streams `StreamEvent`s in contract order; the report is stored as `.data/reports/<id>.json`; `GET /api/check/[id]` returns it | Routes | `tests/contract/stream-order` and `labels-parity` pass |
| A11 | **Actions (no Cal.com).** Email via Resend from the user's Surf account (`RESEND_API_KEY`, `RESEND_FROM`), at most once per `idempotencyKey`; when unset, write `.data/outbox/<key>.json` and return success with the summary "Saved to outbox (demo)". `/api/slots` generates slots locally (next 3 weekdays, 9 AM and 1 PM Pacific). `/api/actions/book` is a specialist request: an email to the specialist with an `.ics` invite attached (METHOD:REQUEST) and a copy to the buyer, through the same Resend/outbox path. Append `ActionLogEntry` to the stored report | `/api/actions/*`, `/api/slots` | A real email lands (or the outbox file exists); the .ics opens in a calendar; a repeated key sends nothing |
| A12 | **Disclosure packet (stretch).** `POST /api/packet` stores the PDF; Claude reads the inspection, pest, TDS/SPQ, 3R, NHD, preliminary title and HOA documents and adds reconciliation rows and a `packet` section | `packet` section, extra ledger rows | A sample packet produces at least one reconciled claim with a page citation |

| A13 | **Sponsor: Senso.ai Context Layer (env-gated, stretch).** When `SENSO_API_KEY` is set, push each finished report's cited sources and action log to Senso as trusted context for the agent ("shopping agent with trusted context" track). Off and silent when unset; never blocks a report | `src/server/sponsors/senso.ts` | With a key, one report appears in Senso; without one, nothing changes |

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
