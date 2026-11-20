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
| `src/contract/fixtures/2055-42nd-ave.ts` | The golden report, real records | B renders it; A's pipeline must reproduce its labels, cases and source ids |

## 2. Ownership: who may edit what

No file has two owners. A pull request that touches a path it doesn't own is rejected by review.

| Path | Owner |
|---|---|
| `src/contract/**`, `tests/contract/**` | Both; changes need both leads' approval (section 4) |
| `app/api/**`, `src/server/**`, `tests/server/**`, `.env.example` | Plan A |
| `app/page.tsx`, `app/check/**`, `app/layout.tsx`, `app/globals.css`, `src/ui/**`, `src/styles/**`, `public/**`, `tests/ui/**` | Plan B |
| `package.json`, lockfile, `tsconfig.json`, `next.config.*`, CI config | Set at M0 together; after M0, only via a "deps" PR both approve |
| `research/**`, `plans/**`, `prototype/**` | Read-only reference after M0 |

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

**Actions.** B holds an email for the 5 second Undo window on the client and then calls
`POST /api/actions/email` once, with a client-made `idempotencyKey`; A sends at most once per key. Booking is
confirmed in B's dialog before `POST /api/actions/book` is called. A appends an `ActionLogEntry` to the stored
report; B shows the returned `entry` at once and the stored log after a refresh.

**Errors.** A returns an `ApiError` with a `kind`. B maps `kind` to its own words from `strings.en.ts` and
never shows `debug` or a status code.

## 4. Changing the contract

1. Open a PR titled `contract: ...` that changes `src/contract/**` and the fixture in the same commit.
2. Both leads approve. CI runs `npm run typecheck` and `tests/contract`, so both sides see the break at once.
3. Additive changes (a new optional field, a new `Glyph` key) can merge the same hour. Renames and removals
   wait for a sync point (section 5).

## 5. Milestones and sync points

| Milestone | Plan A | Plan B | Gate to pass together |
|---|---|---|---|
| **M0, first hour, together** | Scaffold Next.js app, install all dependencies both plans list, CI | Same session | Contract reviewed and frozen; `npm run typecheck` green; branches `plan-a/*` and `plan-b/*` open |
| **M1** | Real pipeline produces a `Report` for the 2055 42nd Ave listing text with the same labels, cases and source ids as the fixture | Every screen built against `mockStream` and the fixture, including a failed step, empty sections and both themes | `tests/contract` green on both branches |
| **M2, integration** | Stream and `GET` live; 6 demo addresses recorded | Flip `NEXT_PUBLIC_MOCK=0` | Same UI, real data, all 6 demo addresses render with no console errors |
| **M3** | Email and booking live, idempotent | Undo window and confirm flows against the live endpoints | A real email arrives; a real booking appears; refresh shows both in the log |
| **M4** | Response cache warm-up, offline demo mode | Design compliance pass (`plans/PLAN-B.md` B8) | Full demo script runs twice in a row |

## 6. Tests both sides run

- `tests/contract/fixture.test.ts`: the fixture typechecks, passes `checkCopy`, and every `[n]` resolves.
- `tests/contract/stream-order.test.ts`: A's stream for the fixture listing yields the same event types in the
  same order as `mockStream`.
- `tests/contract/labels-parity.test.ts`: A's report for the fixture listing has the same `ledger[].label`,
  `cases[].label` and `sources[].id` set as the fixture.
- `tests/ui/render-fixture.test.tsx` (B): the fixture renders with no "undefined", no "NaN", no raw `[n]`
  and no em dash outside `EMPTY_VALUE`.
