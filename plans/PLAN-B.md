# Plan B: the interface

**Goal:** render the stream and the `Report` (see `src/contract/types.ts`) as a calm, polished, fully
compliant Surf interface, and run the buyer's actions with the right undo or confirm. Plan B never fetches city
data or writes report prose; Plan A never touches UI.

**Owns:** `app/page.tsx`, `app/check/**`, `app/layout.tsx`, `app/globals.css`, `src/ui/**`, `src/styles/**`,
`public/**`, `tests/ui/**`.

**Visual spec:** `prototype/index.html` (open it in a browser) and the visual report spec in `prototype/visual-spec/` (`visual.css`, `body.html`, `base.css`). **Rules:** `docs/design/*.md` (the Surf design standard, copied from github.com/zkortam/zakaria-design-docs) and `research/design-digest.md` (tokens,
about 290 checklist items, banned patterns, copy) and the Surf docs it cites.

**Build against mocks from minute one:** with `NEXT_PUBLIC_MOCK=1`, `src/ui/api/` reads `mockStream` over `findFixture(text)` from `src/contract/fixtures` (2055 42nd Ave and 57 Carmelita St) and returns fake `ActionResult`s with the contract's types. Flipping the flag at M2 is the only
integration change.

## Work items

| # | Item | Done when |
|---|---|---|
| B1 | **Foundation.** `src/styles/tokens.css` from design-digest §1 (light and dark), base styles, the blocking boot script for theme, reduced motion and font size; Inter via `next/font` with `display: swap` | Both themes paint before first frame; no `cursor: pointer` anywhere |
| B2 | **Primitives, one each.** Button (primary is the inverted CTA, not the accent), IconButton (48 px, 26 px glyph), Row (12 px gap, 44 px min, no hairlines), Card, SectionLabel, Chip (status: 5% fill, 40% edge, from `LABELS`), Field and Textarea (16 px on touch, no helper text), Dialog (sheet under 640 px, centred from 640), ConfirmDialog, Toast dock (4 s, 5 s with Undo and drain), Collapse (grid rows), Spinner, MetaLine (facts apart by space), CloseButton; one `ICONS` map from `Glyph` to Phosphor (regular, fill only for selected) | Every screen is built only from these |
| B3 | **Start `/`.** One field (listing text or address), example chips that fill it, optional packet attach, draft kept across refresh, errors only on submit, primary "Check this home" | Matches the prototype in both themes at 390 and 1440 px |
| B4 | **Working view.** Steps as rows led by the step's glyph, status at the row's end, real `detail` counts, 150 ms crossfade on status change, `progress` only while no step runs, failed step shows its reason and Retry, Stop only if the server aborts; then the steps collapse to one line | A mocked failed step shows Retry and the rest of the report still renders |
| B5 | **Visual report (non-technical buyers, not a wall of text).** In order: verdict card (`decision.title`, the short `answer` streamed from `delta`, the `decision.inspection` line); 6 tappable `glance` tiles (big value + status dot, tap scrolls to the section; the costs tile shows property tax per month from `costs.rows`); "Good news" / "Worth a look" short icon lists from `highlights`; "Ask before you offer" from `unknowns` grouped by `resolver`, one action button per group; Listing vs City comparisons from `ledger` with big values side by side and the `LABELS[label].compare` icon between (check, clock, crossed circle, question mark); open cases; costs: price slider calling `computeCosts`, a big monthly property tax number and 2 mini tiles; `systems` as year tiles; `hazards` as a 2-column checklist; tenants, upside, `nearby` rows; `history` as a dot timeline with `HISTORY_LEGEND`; sources collapsed; a citation `[n]` opens a small source sheet with "Open the record". Detail text only on tap. Disclaimer and one "Written by AI" line; every section honors `ok`, `empty` and `error` | Both fixtures render exactly at 390 and 1440 px, light and dark; an `error` section never reads as empty |
| B6 | **Actions.** Email dialog prefilled from `drafts`, autosaved, Send closes and holds 5 s with "Email sending" and Undo, then one `POST` with an `idempotencyKey`; specialist request (no Cal.com: the server emails the specialist an .ics invite): slots from `/api/slots`, then a confirm dialog naming who, when and price ("Send request" and "Cancel"), then `POST /api/actions/book`; an outbox result shows its summary ("Saved to outbox (demo)"); action log rows update in place | Undo inside the window sends nothing; confirm and undo are never both on one action |
| B7 | **Navigation and state.** Every state has a URL (`/check/[id]`); refresh restores the report from `GET /api/check/[id]`; Back closes one layer; Escape closes the top overlay only; focus returns to the opener; scroll restoration manual; Share via `navigator.share` with clipboard fallback; tab title "<address> on House Checker" | Refresh, Back and Share behave as listed on phone and desktop |
| B8 | **Compliance pass.** Run the `check.sh` greps from design-digest §2; contrast check; screenshots at 390×844 and 1440×900, light and dark, large font, reduced motion; one accent per screen; three gaps per page; no em dash in UI strings; all strings in `strings.en.ts` pass `checkCopy` | Design-digest checklist items for these screens all tick |

| B9 | **Sponsor: Amplitude (env-gated).** When `NEXT_PUBLIC_AMPLITUDE_API_KEY` is set, send a handful of product events (check started, report shown, tile tapped, source opened, email sent, specialist requested) with the HTTP API from `src/ui/analytics.ts`; no address or email text in event properties. Off when unset | `src/ui/analytics.ts` | With a key, events reach Amplitude; without one, no network call |

## Rules Plan B must keep

- Render what the contract gives; never compute a label, a tax or a sentence locally (except `computeCosts`).
- Label text only from `LABELS`; missing values only as `EMPTY_VALUE`.
- Error kinds map to Plan B's own copy ("Couldn't reach DBI permits", "This address is outside San Francisco");
  never show `debug`, a status code or "Something went wrong".
- Motion: status loops only, nothing over 400 ms, report sections cascade once (8 px rise, 50 ms stagger), no
  celebration when the report finishes.
