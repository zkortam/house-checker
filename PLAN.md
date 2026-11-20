# House Checker: build plan and user flow

Hackathon prompt: *build a personal agent that helps someone make a purchase or complete a shopping task. It
should use reliable context to make decisions, take a meaningful action, and show the information and steps
behind what it did.* Design must comply with the Surf design standard (github.com/zkortam/zakaria-design-docs).

Research behind every claim here: `research/` (data.md, prevalence.md, market-legal.md, competition.md,
buyer-needs.md, money.md, design-digest.md). Design rules are cited as `[doc §n]` from the Surf docs; the digest
maps each to a test.

**How the build is split.** Two plans run in parallel and meet only at the contract in `src/contract/`:
- `plans/PLAN-A.md`: data, rules, the agent and the actions (everything under `/api`).
- `plans/PLAN-B.md`: the interface (every page, primitive and style), built against the contract's mock stream.
- `plans/CONTRACT.md`: ownership, interfaces, milestones and the shared tests that keep the two from conflicting.
- `prototype/index.html`: the clickable visual spec.

---

## 1. What changed after research

| Pitch said | Change | Why |
|---|---|---|
| "Buyer's agent" | "Checks a listing against city records, for you and your agent" | Negotiating a purchase for pay is licensed activity in California (B&P §10131); the state real estate regulator's 2026 AI advisory puts responsibility on licensees |
| "Drafts offer conditions" | "Issues to raise with your agent" plus the actions below | Drafting contract terms risks unauthorized practice of law (B&P §6125). Also 2026 SF offers are often non-contingent within ~3 days, so conditions rarely apply |
| Label "Likely unpermitted" | "No permit found" | Records disagree for innocent reasons; 49% of legal unit additions never reached the assessor roll |
| Assessor = truth | Permits + plumbing permits + unit certificates = truth; assessor is the stale baseline | Latest roll is as of 2025-01-01 and nearly a copy of 2024 |
| Bedrooms "blank" | 0 means unknown (filled for 47% of single-family homes); baths come from plumbing permits | data.md §3 |
| Hazard maps as a feature | One quiet line, noting it is also in the seller's hazard disclosure (NHD) | NHD already covers flood, fault, liquefaction, landslide, fire |
| 311 and crime | Dropped | California fair-housing law covers disparate impact |
| "None of them acts" | "Today's tools either show city records or summarize seller documents. House Checker tests the listing's own claims against San Francisco's records, cites each mismatch, and drafts the next step." | Disclosure-review AIs (BuyerBrief, DisclosureScout) already draft requests |
| Missing | Plumbing and electrical permits, PermitSF, inspections, unit certificates, Planning enforcement | The city's 3R report lists building permits only, never plumbing or electrical; PermitSF holds most permits since 2026-09-14 |

**The product: "what's really up with this house," in minutes.** A buyer pastes a listing and gets the
briefing a sharp local agent, a permit expediter and a real estate attorney would assemble after days of
records requests: what the house legally is, what's wrong or open, what it will really cost to own, who
lives there and what rent control means, what you're allowed to do with it, what's changing around it, and
what is still unknown. The agent then acts on the unknowns, choosing the cheapest way to close each one:
ask the seller, ask the city, or (only when records and documents can't answer it) send a specialist.

**The value moment:** day 0, the first hour after a buyer sees a listing. They decide whether to spend a
weekend, a pre-inspection and an offer on this home, and they decide it knowing what the listing leaves out.

**Pitch numbers (prevalence.md, reproducible scripts in research/prevalence-scripts):**
- 23% of non-condo residential parcels have had a complaint or violation for unpermitted work or an illegal
  unit; 3,303 have one open right now.
- 49% of permitted unit additions completed before 2024, and 29% of permitted bathroom additions, never
  reached the assessor's roll.
- 11% of 2023–2025 sales had a prior unpermitted-work complaint; at least 1.6% sold with a problem still open.
- Stakes: tenant relocation up to $24,733 per unit; legalization ~$60k average, up to $1M; removing an
  illegal unit usually needs Planning Commission approval (Planning Code §317).

---

## 2. How it fits the prompt

| Prompt asks | House Checker |
|---|---|
| Helps someone make a purchase | A complete briefing on one specific home before the buyer commits time and money to it |
| Reliable context | 15+ official city datasets joined on the parcel, plus tax and fee schedules; deterministic rules decide every label and every dollar figure; the model may only cite records the code fetched |
| Makes decisions | Labels each listing claim; computes the true cost to own; decides what is still unknown and the cheapest way to resolve each unknown (seller, city, specialist, or nothing needed) |
| Meaningful action | Sends the questions and records request to the listing agent; files the city records request where needed; books a specialist only for what documents can't answer; hands the buyer's agent a brief |
| Shows information and steps | Live step list with real counts; every finding and every number links to its record or schedule; an action log with what was sent and when |

---

## 3. User flow

Every state has a URL; Back undoes one layer [principles 13] [navigation-and-history].

### 3.1 `/` Check a home
- One field, focused on load: paste the listing text, or just the address. Chips under it fill the field with
  demo listings [ai §5]. Primary button: **Check this home**.
- Paste is ordinary input [ai §22]; the address and claims are pulled from the text (one model call,
  structured output). Field validation happens on submit, never while typing [input-and-forms].
- Optional, and usually later: drop in the disclosure packet (PDF, 100–300 pages). The agent reads the
  inspection, pest report, seller disclosures (TDS/SPQ), 3R, hazard report, preliminary title and HOA
  documents, and reconciles them with the city records: what the seller admitted, what they didn't, and
  the dollar exposure in the inspection reports. This is the single most tedious task in an SF purchase.
  When the packet isn't out yet, the email to the listing agent asks for it.
- The draft survives refresh (localStorage) [principles 6].

### 3.2 `/check/{id}` Working (same page becomes the report)
Title: the address. The person sees work, then what changed [ai §26a]:

```
◉ Found the parcel                         2162-008  ✓
◉ Read the assessor's roll                 as of Jan 1, 2025  ✓
◉ Read building permits                    7 permits  ✓
◉ Read plumbing and electrical permits     reading 9 of 14…
◉ Read complaints and violations           6 complaints, 4 notices  ✓
◉ Read Planning records                    3 records  ✓
◉ Read zoning and lot                      RH-1, 2,500 sq ft lot  ✓
◉ Worked out taxes and fees                at $1,450,000  ✓
◉ Checked tenants and rent control         ✓
◉ Looked around the block                  2 projects within 150 m  ✓
◉ Checked hazard zones                     ✓
  Comparing with the listing…              (AiProgressLine, only when no step runs)
```
- One row per dataset group, led by its glyph, status at the row's end; counts are real [ai §9]. Steps run in
  parallel and complete out of order; a state change is a 150ms crossfade [motion].
- A failed source shows its reason under its title with **Retry**; the rest of the report still renders
  [loading-and-states]. "Couldn't reach DBI permits" is never shown as "No permits".
- **Stop** stands where the primary button was, only if the server really aborts [ai §6].

### 3.3 Report (same URL, steps collapse into one line "Read 41 records from 9 city sources")
The report is a briefing, ordered by what changes the buyer's decision. Sections with nothing to say
collapse to one line ("No open city cases"), never vanish, so absence reads as an answer [principles 8].

1. **The short answer.** What this house really is and the three things that matter most, with citations:
   "A legal two-unit home: the lower unit was legalized in 2025 after years of illegal-unit complaints. Four
   permitted baths, though the assessor still lists one. Expect about $X a year in property tax at the asking
   price. [1][3][5]"
2. **What you're actually buying: listing vs city records**, the one object of the page
   [principles 20]. A compact ledger, one row per claim:
   ```
                 Listing     City records            
   Units         2           2 (ADU, final 2025)     Permitted, assessor not updated
   Baths         4           4 (plumbing finals)     Permitted, assessor not updated
   Sq ft         2,000       1,300 assessor          Records differ        
   In-law        "legal"     Legalized 2025          Resolved
   Bedrooms      4           —                       Records don't settle this
   ```
   Tapping a row expands its evidence in place (Collapse), never a new page.
3. **Problems and open cases**: active complaints, violation notices, Planning enforcement, permits never
   finaled, expired permits, unsafe-building flags; each with its stake in dollars and consequences.
   Also units that disappeared: a permit or roll history where the unit count went down without Planning
   approval, the 524 Vallejo case (a $4.75M home the city is ordering back into four units).
3a. **The bones**: age of the major systems read from permit history, with cost bands when there's no
   record of the work: wiring (no rewire permit on a pre-1940 house means possible knob-and-tube, an
   insurance problem), sewer lateral, foundation and seismic work, roof. Ends with "get an insurance quote
   before you offer" when the profile says insurers may balk.
3b. **For condos and TICs**: building-wide cases, soft-story, the HOA documents to read (reserves,
   assessments under discussion in the minutes, litigation, insurance), FHA approval, and a prompt to have
   the lender check whether the building is financeable before offering.
4. **What it will really cost**: property tax at the asking price (and at the buyer's own number), the
   first-year supplemental bill, transfer tax and who usually pays it in SF, required work that rides with
   the building (soft-story retrofit, point-of-sale requirements), and cost ranges for any problem found
   (legalizing work, finishing a non-finaled permit). Every figure shows its formula and source.
5. **Tenants and rent control**: whether the units are rent-controlled (year built, unit count, ADU
   agreement), eviction or buyout history on the parcel, and what that means for moving in, relocation
   payments and allowable rent increases.
6. **What you can do with it**: zoning and height in plain words, ADU and lot-split (SB 9) signals,
   historic-district limits, lot and building size, what Planning has approved before on this lot.
7. **Around the house**: construction and Planning projects next door and on the block, the city's storm
   flood map, seismic zones, street tree responsibility, parking permit area. Nothing about crime or schools
   (fair housing).
8. **History**: the permit timeline, resolved cases, how long the seller has owned it. Collapsed by default.
9. **Still unknown, and how to find out**: each open question, why it matters, and the cheapest way to
   settle it (see 3.4). This section is what the actions act on.
10. **Sources**: numbered, title then publisher and date apart, linked to the record [ai §19]. "Checked
   Nov 20, 2:14 PM" stamp from the browser clock.
11. Once, at the end: "Compares the listing's claims with public City records. It is not an inspection,
   appraisal, or legal advice. Records may be incomplete, and unpermitted work may not appear in any record."
   and the AI disclosure once [ai §26b].

Labels (status chips are state, not decoration: 5% fill, 40% border):

| Label | Rule (data.md "Label rules") |
|---|---|
| Permitted, assessor not updated | Finaled permit (plus unit certificate for units) explains the gap |
| Permitted, not finaled | Issued permit, no final inspection |
| No permit found | Listing claims more than records and no permit explains it; stronger if a past case mentions an illegal unit or in-law |
| Open city case | Active complaint, active violation notice, or open Planning enforcement |
| Resolved | Closed case followed by a permit that says "comply with NOV #…" |
| Records don't settle this | Field blank or contradictory (bedrooms, most sq ft) [ai §20, abstained] |

Lien-date logic is explicit: work completed after the roll's Jan 1 date is "expected lag", stated in the
row ("finished after the assessor's Jan 1, 2025 snapshot").

### 3.4 Next steps (the actions)
The agent's decision is per unknown, not per house: for each open question it picks the cheapest way to
close it, and proposes nothing when the records already settle everything. The person decides; each
proposal sits as a draft beside the report, never sent on its own.

| Unknown | Cheapest way to close it | Action |
|---|---|---|
| Is the open violation resolved? Was the in-law legalized? Where are the job cards? | Seller's documents | Email the listing agent (a) |
| Planning case still "under review" after a 2025 certificate | The city | Draft the inquiry to Planning or DBI, or file the records request (b) |
| Unpermitted bath or garage conversion: is it safe, what would legalizing cost? | A specialist on site | Book an inspector scoped to the finding (c), only when documents can't answer it |
| How to price the risk, what to ask for | The buyer's own agent | The brief for your agent (d) |
| Nothing open | None | Say so: "Records answer every claim in this listing" |

**a) Questions and records request to the listing agent** (email)
- Drafted from the unknowns, never a generic checklist: the 3R report, finaled job cards for the named
  permits, the certificate of final completion for the ADU, the status of open violation notice #…,
  plumbing finals for the baths, whether any unit is tenant-occupied, the disclosure packet.
- Opens in the draft editor (Dialog, bottom sheet on phone) with the listing agent's address field and the
  text editable; drafts autosave.
- **Send** is held for 5s with "Email sending · Undo", then sent; closing the tab inside the window sends
  nothing [feedback §33]. Undo or confirm, never both. Idempotency key on the send [resilience §20].
- Toast after: "Email sent". The action log records it with time and recipient.

**b) Ask the city**
- When a city record is stale or contradictory (an open Planning enforcement case after a certificate of
  completion), draft the inquiry to the right department with the record numbers, or the public records
  request. Same send pattern as (a).

**c) A specialist, only when needed** (booking)
- Proposed only for a question that documents and records cannot settle (unpermitted work of unknown
  quality, active excavation, a landslide zone with a hillside foundation). The scope comes from the
  finding: e.g. "structural engineer: over-excavation cited in complaint 202665866". No finding, no booking.
- Shows inspector slots from a real calendar (demo inspector account). Ranked by fit to the scope; the page
  says no one paid for placement and the buyer pays the inspector directly (RESPA §8, B&P §7197).
- **Book** is irreversible, so it is confirmed: a dialog naming inspector, date, time and price, with Book
  and Cancel [principles 7] [feedback]. The booking carries the inspection checklist in its notes.

**d) Brief for your agent**
- A short list in plain words, each tied to a finding and its stake ("If the lower unit isn't legal, removing
  it usually needs Planning Commission approval and tenant relocation can reach $24,733"). Copy and Share.
  No contract language.

### 3.5 Share
- The report URL works on refresh and in another browser. Share uses `navigator.share` with a clipboard
  fallback; no print stylesheet [platform §27].

---

## 4. Architecture

```
Browser (Next.js page)                       Server (Next.js route handlers)
 ├ /             paste field                  POST /api/check      → SSE stream
 ├ /check/{id}   steps → report → actions     GET  /api/check/{id} → stored report
 └ draft editor, confirm dialog, toasts       POST /api/actions/email   (after Undo window)
                                              POST /api/actions/book    (after confirm)
```

**Stack:** Next.js (App Router) + TypeScript; plain CSS with `tokens.css` from design-digest §1 (no Tailwind
needed); Phosphor icons (regular + fill); Inter via Google Fonts. Deploy on Vercel. Reports stored in a KV
store (Vercel KV / Upstash) keyed by id.

**Pipeline (code decides, the model reads and writes):**
1. `parseListing` — Claude, structured output → `{address, claims: {units, baths, beds, sqft, adu, renovations[]}}`.
2. `resolveParcel` — address file `ramy-di5m` → all parcels on the base address, lat/lon, lot lineage.
3. `fetchRecords` — parallel SoQL queries (data.md "Query plan": assessor, building permits, PermitSF,
   plumbing, electrical, inspections, unit certificates, Housing Production, complaints, violation notices,
   Planning, soft-story) and ArcGIS hazard queries. Each emits a `step` event with a real count.
4. `normalize` — every record becomes `Evidence {id, dataset, recordId, date, title, url, fields}`. Dedupe
   permits by number; never split parcel numbers by position.
5. `readPermitText` — Claude, structured output, over permit descriptions only:
   `{recordId, addsBaths, addsUnit, legalizesUnit, garageConversion, citesNov[]}` per permit.
6. `rules` — deterministic: unit timeline (completed unit-changing permits → certificate → Housing
   Production), bath count from finaled plumbing permits, lien-date lag, labels from the table above.
   Output: `Finding {claim, listing, records, label, evidenceIds[], stake?}`.
7. `explain` — Claude writes the short answer, each finding's sentence, the email draft, the inspection
   scope and the issues list, citing `[n]` only from `evidenceIds`. A validator rejects any citation not in
   the evidence set and any number that does not appear in the evidence (retry once, then show the
   deterministic sentence).
8. Stream events: `step`, `progress`, `finding`, `sources`, `delta`, `done`, `error` (extends the ai.md
   stream protocol with `step` and `finding`) [ai §11].

**Why a pipeline, not a free-roaming agent loop:** the prompt rewards reliable context. Code fetches and
labels; the model reads unstructured permit text and writes, and can't invent a record. The "agent" part is
the decision (scope, which records to request, whether to inspect) and the actions, each gated by the person.

**Claude API:** `@anthropic-ai/sdk`, model `claude-opus-5-5`. Structured outputs (`output_config.format`) for
steps 1, 5, 7; effort `low` for 1 and 5, `medium` for 7; streaming for 7. Check `stop_reason` before reading
content; enable server-side refusal fallbacks (`fallbacks: "default"`). Cache the system prompt.

**Actions:**
- Email: Resend (or Gmail API) from a verified demo domain. Server holds nothing until the client posts after
  the Undo window.
- Booking: Cal.com API (a demo inspector account with an event type) so the booking is real and appears on a
  calendar. Verify the current Cal.com booking API when building.

**Demo resilience:** cache every DataSF and ArcGIS response per parcel for 24h; pre-warm the demo addresses
before presenting. Cached data is real data with its checked time shown, not fixtures [principles 17].

---

## 5. Demo script (3 minutes)

1. **Hook (20s):** "23% of San Francisco homes have had a complaint for unpermitted work or an illegal unit.
   Half of the legal unit additions never reached the assessor. The listing won't tell you which."
2. **1665 North Point St (60s):** paste the listing. Steps run live. The briefing: complaints about an
   unpermitted remodel and basement conversion, violation notice 202308900 still active (the house sold 13
   days after the complaint); what that costs to legalize; the tax at asking; rent control status; what's
   being built next door. "Still unknown": whether the basement work is safe and whether the notice can be
   closed.
3. **Act (50s):** the agent sends the listing agent the specific questions and records request (Undo window
   visible); because only a site visit can say whether the basement work is sound, it books a scoped
   inspection (confirm dialog, booking appears on the calendar). Show the action log.
4. **No false alarms (30s):** 2055 42nd Ave. Assessor says 1 unit, 1 bath; the agent says 2 units and 4 baths
   are permitted, the illegal-unit case is resolved, and the assessor is behind. It proposes no inspection
   beyond the buyer's usual one; the only unknown is a stale Planning case, so it drafts one question to
   Planning. Click a source: the DataSF record opens.
5. **Close (20s):** what's different from permit lookups and disclosure summarizers; who pays (buyer's agents
   first, buyers at $50–$150 per home).

Backups: 998 Burnett Ave (legalized in-law, roll still 1 unit), 57 Carmelita St (open work-without-permit
case, active now), 63 Jules Ave (permitted bath, landslide zone), 686 Colby St (control: records agree).

---

## 6. Build order

| # | Work | Done when |
|---|---|---|
| 1 | Data layer + rules as a CLI over the 6 demo addresses | Labels match data.md §4 and prevalence.md §6 for each |
| 2 | `/api/check` SSE + steps UI | Steps arrive with real counts; a forced failure shows Retry while the rest renders |
| 3 | Ledger, open cases, history, sources | Every finding links to its record |
| 4 | Claude: parse listing, read permit text, explain with citation validator | No uncited or unsupported number reaches the screen |
| 5 | Actions: email with Undo window, booking with confirm, action log | A real email lands; a real booking appears |
| 6 | Design pass: tokens, dark mode, 390px and 1440px, reduced motion, `check.sh` | design-digest §2 checklist passes |
| 7 | Demo hardening: cache warm-up, backup recording | Demo runs with Wi-Fi off from cache |

The build order above is now split across `plans/PLAN-A.md` and `plans/PLAN-B.md`, with shared milestones in
`plans/CONTRACT.md` §5.

## 7. Decisions still open
- Email provider (Resend vs Gmail API) and booking provider (Cal.com vs a simple calendar invite).
- How much time and how many people; that sets whether the disclosure packet reader (A12) stays in scope.
