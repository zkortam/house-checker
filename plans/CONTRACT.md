# The contract between Plan A and Plan B

Plan A (data and agent) and Plan B (interface) are built at the same time by different engineers. They meet
in exactly one place: `src/contract/`. Everything here exists so that the two halves can be merged without a
single conflict, and so that "it works on my side" means it works together.

## 1. What is in the contract

| File | What it fixes | Who uses it |
|---|---|---|
| `src/contract/types.ts` | The `Report` shape, the SSE `StreamEvent` protocol, every endpoint's request and response, the error kinds | A produces, B consumes |
| `src/contract/labels.ts` | The label vocabulary and its display text and tone, and `EMPTY_VALUE` | A picks labels, B renders them |
| `src/contract/money.ts` | Tax, supplemental bill and transfer tax formulas | A fills `costs.rows`, B recomputes when the buyer edits the price |
| `src/contract/copy.ts` | `checkCopy` and `checkCitations`, the copy rules as code | A on every generated string, B on `strings.en.ts` |
| `src/contract/mock-stream.ts` | Replays a `Report` as the exact event sequence of `/api/check` | B builds against it; A's stream test matches it |
| `src/contract/fixtures/2055-42nd-ave.ts` | The golden report, real records (incl. 2020 buyout, hotel-tax registration, Sunset reservoir zones, 3327 Quintara project) | B renders it; A's pipeline must reproduce its labels, cases and source ids |
| `src/contract/fixtures/57-carmelita-st.ts` | Second golden report: open complaints, case fees, specialist request, landslide class 7 | Same as above |
| `src/contract/fixtures/index.ts` | `FIXTURES` and `findFixture(text)` | B's mock API picks a fixture by listing text; A's tests iterate both |

## 2. Ownership: who may edit what

No file has two owners. A pull request that touches a path it doesn't own is rejected by review.

| Path | Owner |
|---|---|
| `src/contract/**`, `tests/contract/**` | Both; changes need both leads' approval (section 4) |
| `app/api/**`, `src/server/**` (incl. `src/server/llm.ts`, `src/server/sponsors/**`), `tests/server/**`, `.env.example` | Plan A |
| `app/page.tsx`, `app/check/**`, `app/layout.tsx`, `app/globals.css`, `src/ui/**` (incl. `src/ui/analytics.ts`), `src/styles/**`, `public/**`, `tests/ui/**` | Plan B |
| `package.json`, lockfile, `tsconfig.json`, `next.config.*`, CI config | Set at M0 together; after M0, only via a "deps" PR both approve |
| `research/**`, `plans/**`, `prototype/**`, `docs/**` | Read-only reference after M0 (the integrator session edits them) |
| `README.md`, `PLAN.md` | Integrator session |

## 3. Interfaces in one page

**Routes.** B owns the pages; A owns everything under `/api`.

| Route | Owner | Contract |
|---|---|---|
| `/` | B | Start: paste field, example chips, optional packet |
| `/check/[id]` | B | Working view, then the report. A refresh calls `GET /api/check/[id]` |
| `POST /api/check` | A | `CheckRequest` in, `text/event-stream` of `StreamEvent` out |
| `GET /api/check/[id]` | A | `Report`, or `ApiError` with kind `not_found` |
| `POST /api/packet` | A | PDF upload, returns `{ packetFileId }` |
| `POST /api/actions/email` | A | `EmailSendRequest`, returns `ActionResult` |
| `GET /api/slots` | A | `SlotOffer` |
| `POST /api/actions/book` | A | `BookRequest`, returns `ActionResult` |

**Stream order.** `run`, then one `step` per source (`running`, then `done` or `failed`, in any order),
`progress` only while no step runs, `delta` words of the short answer, one `report`, then `done`. A stream that
ends without `done` is a failed run. `error` ends a run that can't produce a report (not in San Francisco,
address not found, rate limit).

**Partial failure.** A failed source is a failed `step` plus `sections[key] = { state: 'error', source, retryable }`
in the report. The other sections still render. A never turns a failure into an empty section, and B never
renders `error` as `empty` (Surf loading-and-states §4).

**Text.** Every string A writes into a `Report` is plain text that passes `checkCopy`, and every `[n]` passes
`checkCitations`. B renders `[n]` as a link to source n and never parses anything else out of text. Display
text for labels comes only from `LABELS`. Missing values are `null`; B renders `EMPTY_VALUE`.

**Glyphs.** A names a `Glyph` key; B maps each key to exactly one Phosphor icon. Neither invents a key without
a contract change.

**Money.** A sets `costs.inputs` and `costs.rows = computeCosts(price, inputs)`. B never formats a tax by hand;
on a price edit it calls `computeCosts` with the same inputs.

**Stack decisions (fixed at M0).** No Anthropic API and no API key: the LLM is the local Claude Code CLI,
wrapped by A in `src/server/llm.ts` (timeout, one retry, at most 3 concurrent, template fallback). Email is
Resend from the user's Surf account (`RESEND_API_KEY`, `RESEND_FROM`); unset means `.data/outbox/*.json` and the
summary "Saved to outbox (demo)". No Cal.com: "book a specialist" is a request email with an `.ics` invite to
the specialist and a copy to the buyer; slots are generated locally. Storage is JSON under `.data/`.

**Actions.** B holds an email for the 5 second Undo window on the client and then calls
`POST /api/actions/email` once, with a client-made `idempotencyKey`; A sends at most once per key. Booking is
confirmed in B's dialog before `POST /api/actions/book` is called. A appends an `ActionLogEntry` to the stored
report; B shows the returned `entry` at once and the stored log after a refresh.

**Errors.** A returns an `ApiError` with a `kind`. B maps `kind` to its own words from `strings.en.ts` and
never shows `debug` or a status code.

**Visual report.** The top of the report is driven by `decision` (title + `inspection`), `glance` (6 tiles in
fixed order), `highlights` (good / watch) and `LABELS[label].compare` (the icon between Listing and City). A
produces them; B renders them as specified in `plans/PLAN-B.md` B5 and `prototype/visual-spec/`.

## 4. Changing the contract

During the hackathon: write the request to `/home/surf/hc-ops/requests.md`. Only the integrator session edits
`src/contract/**` on `main`, updates the fixtures in the same commit, pushes, and notes it in `notes-a.md` /
`notes-b.md`; A and B then `git merge main`.

1. Open a PR titled `contract: ...` that changes `src/contract/**` and the fixture in the same commit.
2. Both leads approve. CI runs `npm run typecheck` and `tests/contract`, so both sides see the break at once.
3. Additive changes (a new optional field, a new `Glyph` key) can merge the same hour. Renames and removals
   wait for a sync point (section 5).

## 5. Milestones and sync points

| Milestone | Plan A | Plan B | Gate to pass together |
|---|---|---|---|
| **M0, integrator session** | Scaffold Next.js 16 app (vitest, Phosphor), both fixtures, docs and visual spec copied | Same session | Contract frozen; `npm run typecheck`, `npm test`, `npm run build` green; branches `plan-a` and `plan-b` with worktrees `/home/surf/hc-a`, `/home/surf/hc-b` |
| **M1** | Real pipeline produces a `Report` for the 2055 42nd Ave listing text with the same labels, cases and source ids as the fixture | Every screen built against `mockStream` and the fixture, including a failed step, empty sections and both themes | `tests/contract` green on both branches |
| **M2, integration** | Stream and `GET` live; 6 demo addresses recorded | Flip `NEXT_PUBLIC_MOCK=0` | Same UI, real data, all 6 demo addresses render with no console errors |
| **M3** | Email and specialist request (.ics) live via Resend or outbox, idempotent | Undo window and confirm flows against the live endpoints | A real email (or outbox file) exists; the .ics opens in a calendar; refresh shows both in the log |
| **M4** | Response cache warm-up, offline demo mode | Design compliance pass (`plans/PLAN-B.md` B8) | Full demo script runs twice in a row |

## 6. Tests both sides run

- `tests/contract/fixture.test.ts`: the fixture typechecks, passes `checkCopy`, and every `[n]` resolves.
- `tests/contract/stream-order.test.ts`: A's stream for the fixture listing yields the same event types in the
  same order as `mockStream`.
- `tests/contract/labels-parity.test.ts`: A's report for the fixture listing has the same `ledger[].label`,
  `cases[].label` and `sources[].id` set as the fixture.
- `tests/ui/render-fixture.test.tsx` (B): the fixture renders with no "undefined", no "NaN", no raw `[n]`
  and no em dash outside `EMPTY_VALUE`.

## 7. Sponsor integrations (tokens& Personal Agents Hackathon)

Sponsors listed on https://tokensand.com/personalagenthack (fetched 2026-11-20): Senso.ai (context layer),
Amplitude + Statsig (analytics, flags), Superlinked (SIE serverless inference), Guild AI (agent infra), Airbyte
(data integration), Arcee AI (open-weight models), Cognee (agent memory), Firedrill (agent simulation),
SingleStore (real-time database), Persona (agent and identity verification).

| Sponsor | Use | Owner | Gate |
|---|---|---|---|
| Senso.ai | Push each report's cited sources and action log as trusted context (A13) | Plan A | `SENSO_API_KEY`; off when unset |
| Amplitude | Product events from the UI, no personal data (B9) | Plan B | `NEXT_PUBLIC_AMPLITUDE_API_KEY`; off when unset |
| Guild AI "Most Interesting Use of Agents" | No integration needed; enter the project as is | Integrator | none |
| Superlinked, Arcee, Cognee, Firedrill, SingleStore, Airbyte, Persona, Statsig | Not used: the LLM is the local Claude Code CLI, storage is JSON files, data comes straight from DataSF, and nothing here needs identity checks or flags | none | none |

## 8. Coverage: every product feature in PLAN.md, and who builds it

A + B together are the complete product. Every row has exactly one builder; "shared" means a contract file.

| PLAN.md feature | Where in PLAN.md | Plan A builds | Plan B builds |
|---|---|---|---|
| Paste field, example chips, draft kept across refresh | 3.1 | | B3 |
| Address and claims pulled from the text; reject outside SF | 3.1 | A1 (CLI + regex fallback) | B3 error copy |
| Disclosure packet upload and reconciliation | 3.1 | A12 (stretch), `POST /api/packet` | B3 attach, `packet` section |
| Every state has a URL; Back undoes one layer; refresh restores | 3 | `GET /api/check/[id]`, A10 store | B7 |
| Live steps with real counts, out-of-order completion | 3.2 | A3 step events | B4 |
| Failed source shows reason and Retry, rest renders | 3.2 | A3 failed step + `sections[key].error` | B4, B5 error state |
| Stop while running | 3.2 | Abort on client disconnect (A10) | B4 |
| Parcel resolution (all parcels, suffix units, lineage) | 4 step 2 | A2 | |
| Record fetchers, 24 h cache, demo warm-up | 4 step 3, 6 | A3, `.data/cache` | |
| Sources with exact record links | 3.3 item 10 | A4 | B5 source list + source sheet |
| Permit text reading | 4 step 5 | A5 (CLI) | |
| Labels per claim, lien-date lag | 3.3 item 2 | A6 | B5 Listing vs City with compare icon |
| Verdict card: plain title, short answer, inspection line | 3.3 item 1 | A8 decision, A9 answer | B5 |
| Six glance tiles | visual direction | A6 `glance` | B5 tiles |
| Good news / Worth a look | visual direction | A6 + A9 `highlights` | B5 lists |
| Problems and open cases with stakes; vanished units | 3.3 item 3 | A6 `cases` | B5 |
| The bones: system years and cost bands | 3.3 item 3a | A6 `systems` | B5 year tiles |
| Condos and TICs: building-wide cases, HOA documents | 3.3 item 3b | A6 extra `cases` / `unknowns` rows (multi-parcel) | B5 renders them as cases |
| True cost to own: tax at any price, supplemental, transfer, case fees | 3.3 item 4 | A7 inputs + shared `money.ts` | B5 price slider, big monthly tax, 2 mini tiles |
| Tenants, rent control, buyouts, short-term rental signal | 3.3 item 5 | A6 `tenants` (wmam-7g8d, g8m3-pdis, no names) | B5 |
| What you can do with it: zoning, SB 9, ADU, historic | 3.3 item 6 | A6 `upside` | B5 |
| Around the house: projects nearby | 3.3 item 7 | A6 `nearby` (qvu5-m3a2, 150 m) | B5 |
| Hazards checklist (8 maps incl. reservoir, landslide class) | 3.3 item 7 | A6 `hazards` | B5 2-column checklist |
| History timeline with kinds | 3.3 item 8 | A6 `history` | B5 dot timeline + legend |
| Still unknown, cheapest resolver per unknown | 3.3 item 9, 3.4 | A8 `unknowns` | B5 "Ask before you offer", grouped by resolver |
| Email the listing agent, 5 s Undo, idempotent | 3.4 a | A11 `/api/actions/email` (Resend or outbox) | B6 dialog + Undo |
| Ask the city | 3.4 b | A9 `drafts.cityEmail`, A11 | B6 |
| Specialist request with .ics, confirm dialog | 3.4 c | A11 `/api/slots`, `/api/actions/book` | B6 confirm "Send request" |
| Brief for your agent: copy and share | 3.4 d | A9 text in `unknowns` with resolver `buyer_agent` | B6 Copy / Share |
| Action log, survives refresh | 3.4 | A11 append to stored report | B6 |
| Share link | 3.5 | stored report by id | B7 `navigator.share` |
| Disclaimer and AI disclosure once | 3.3 item 11 | | B5 |
| Copy rules on every string | 2 | A9 `checkCopy` | B8 strings test |
| Design compliance, light and dark, 390 and 1440 px | 6 | | B1, B2, B8 |
| LLM via Claude Code CLI with fallback | 4 | A9 `src/server/llm.ts` | |
| Sponsor integrations | 7 | A13 Senso | B9 Amplitude |
| Integration, build, demo run, README, STATUS | 5, 6 | Integrator session (Phase 3) | Integrator session |
