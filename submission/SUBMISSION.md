# House Checker — submission

Answers to the fields on https://tokensand.com/personalagenthack ("What to submit": repo, demo video, what you
built and the tools you used, team names and contact emails, optional website and screenshot). The submission
form itself (https://tokensand.com/personalagenthack/submit) needs a sign-in, so the exact fields could not be
read; everything it is likely to ask is below.

## Name
House Checker

## One-line pitch
Paste a San Francisco listing: House Checker checks every claim against the city's own records, shows the
evidence in plain words, and takes the next step for you: emailing the listing agent, asking the city, or
requesting a specialist only when no record can answer.

## The challenge, and how this answers it
*"Build a shopping agent with an audit trail ... use reliable context to make decisions, take a meaningful
action, and show the information and steps behind what it did."*

| Challenge asks | House Checker |
|---|---|
| A real purchase | The biggest one most people make: a home, in the first hour after seeing the listing |
| Reliable context | 20+ official DataSF datasets joined on the parcel, plus tax and fee schedules. Code decides every label and every dollar figure; the model only reads permit text and writes sentences that must cite records the code fetched |
| Makes decisions | Labels each listing claim (matches, approved but tax roll behind, no permit found, open city case...), works out the true cost to own, and picks the cheapest way to settle each unknown: the listing agent, the city, a specialist, or nothing needed |
| Meaningful action | Sends the listing agent specific questions and a records request (5 s Undo, idempotent), emails the city about stale cases, and sends a specialist a visit request with a calendar invite after a confirm dialog |
| Shows the steps | Live step list with real counts; every finding and number links to its record ("Open the record"); an action log ("What you sent") stored with the report |

## The problem
23% of San Francisco's non-condo residential parcels have had a complaint or violation for unpermitted work or
an illegal unit, and 3,303 have one open right now. 49% of permitted unit additions never reached the
assessor's roll, so the "official" numbers on listing sites are often wrong in both directions. A buyer finds
out days later, after records requests, or never. (Reproducible scripts in `research/prevalence-scripts/`.)

## What it does
1. Paste listing text or an address. The agent parses the claims (units, baths, beds, sq ft, in-law, renovation).
2. Live steps: finds every parcel on the address, then reads the assessor's roll, building, plumbing and
   electrical permits, certificates of completion, complaints and violation notices, Planning cases and
   projects, tenant buyouts, hotel-tax registrations (short-term rental signal, never names), zoning and
   historic districts, projects within 150 m, and 8 hazard maps.
3. A visual report for non-technical buyers: a verdict ("Looks solid" / "Get it checked before you offer"),
   six glance tiles, good news and worth-a-look lists, Listing vs City comparisons, open cases with their
   dollar stakes, taxes at any price (slider), building systems by year, hazards checklist, history timeline,
   and every source one tap away.
4. "Ask before you offer": unknowns grouped by who can answer, one action per group, each with Undo or a
   confirm step, all logged.

Two real examples (real city records; the listing text is an example):
- **2055 42nd Ave**: the assessor says 1 unit and 1 bath. Permits show the in-law was legalized in 2025 and
  four baths passed final inspection, so the listing is right and the tax roll is behind. No false alarm. It
  also surfaces a 2020 tenant buyout, a hotel-tax registration since 2023 and a reservoir failure zone.
- **57 Carmelita St**: "fully renovated 2026, garden in-law". Records show two active complaints about
  excavation (one filed Nov 17, 2026), a $616,835 permit not signed off, and no permit for a second unit. The
  agent requests a structural engineer and emails the agent the exact questions.

## How it works
- **Next.js 16** (App Router, TypeScript). `POST /api/check` streams Server-Sent Events: steps with real
  counts, the short answer word by word, then the full report.
- **Data**: DataSF Socrata APIs (`ramy-di5m`, `wv5m-vpq2`, `i98e-djp9`, `a6aw-rudh`, `ftty-kx6y`, `j67f-aayr`,
  `gm2e-bten`, `y673-d69b`, `qvu5-m3a2`, `wmam-7g8d`, `g8m3-pdis`, `bna4-itif`, `7crf-46s6`, `jzu3-4yxp` and
  more) and FEMA flood maps, in parallel with timeouts, a retry and a 24 h cache.
- **Rules, not vibes**: deterministic code assigns every label, case, cost and decision. Money uses the FY
  2026-27 tax rate resolution, supplemental proration and the Article 12-C transfer tax.
- **LLM**: the local **Claude Code CLI** (`claude -p --json-schema`, Claude Opus 5.5) parses the listing,
  reads permit descriptions and writes the short answer. Every sentence must pass copy and citation checks and
  may not introduce a number absent from the evidence; otherwise a rule-written sentence is used. No API key.
- **Actions**: Resend email (outbox file in demo mode), idempotency keys, `.ics` invites for specialist
  requests, an action log stored with the report.
- **Fair housing**: no crime, school or demographic data; no personal names from city records.

## Tools used
Claude Code (CLI, Claude Opus 5.5), Next.js 16, React 19, TypeScript, Phosphor icons, DataSF (Socrata),
FEMA NFHL, Resend, Vitest, Playwright (demo recording), ffmpeg.

## Sponsor tools
- **Senso.ai** (context layer): each finished report's findings, sources and action log are pushed to Senso
  as trusted context (`src/server/sponsors/senso.ts`). Env-gated by `SENSO_API_KEY`; not active in the
  recorded demo because no key was available.
- **Amplitude**: product events (check started, report shown, tile tapped, source opened, email sent,
  specialist requested; no addresses or text) from `src/ui/analytics.ts`. Env-gated by
  `NEXT_PUBLIC_AMPLITUDE_API_KEY`; not active in the recorded demo.
- Suggested tracks: Senso "Best Use of Senso" (shopping agent with trusted context) once a key is set, and
  Guild AI "Most Interesting Use of Agents".

## Team
- Names and contact emails: **to be filled in by the team** (not included here on purpose).

## Links
- Repository: https://github.com/zkortam/house-checker
- Demo video: `submission/demo.mp4` in the repo (2:18, 1440×900). Upload it somewhere shareable for the form.
- Screenshots: `submission/screenshots/` (1 verdict and tiles, 2 listing vs city, 3 specialist request
  confirm, 4 phone view).
- Website: runs locally (`npm run build && npm run start`); the LLM is a local CLI, so there is no hosted deploy.

## How to run
```
npm install
cp .env.example .env.local   # optional: RESEND_API_KEY, RESEND_FROM, SENSO_API_KEY, ...
npm run build && npm run start   # http://localhost:3000
node scripts/demo-check.mjs      # headless end-to-end check
```
Needs Node 24 and a logged-in Claude Code CLI.

## Not advice
House Checker compares a listing's claims with public city records. It is not an inspection, appraisal or
legal advice.
