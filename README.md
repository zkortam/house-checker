# House Checker

Paste a San Francisco listing. House Checker reads the city's own records for that parcel and tells you what is
really up with the house: what it legally is, what's open or unpermitted, what it will cost to own, who lives
there and what rent control means, what you're allowed to build, and what is still unknown. Then it acts on the
unknowns: it emails the listing agent the right questions, asks the city, or books a specialist only when no
record can settle the question. Every finding links to the exact record behind it.

Built for the prompt: *a personal agent that helps someone make a purchase, uses reliable context to make
decisions, takes a meaningful action, and shows the information and steps behind what it did.*

## Start here

| | |
|---|---|
| `prototype/index.html` | Clickable visual spec. Open it in a browser and try the two example listings |
| `PLAN.md` | Product plan, user flow, architecture, demo script |
| `plans/CONTRACT.md` | How Plan A and Plan B are built in parallel without conflicts |
| `plans/PLAN-A.md` | Data, rules, the agent and the actions |
| `plans/PLAN-B.md` | The interface, to the Surf design standard |
| `src/contract/` | The shared types, labels, money formulas, copy checks, mock stream and golden fixture |
| `research/` | Data feasibility, prevalence numbers, market and legal context, competitors, buyer needs, money, design digest |

## Key numbers (research/prevalence.md)

- 23% of non-condo residential parcels in San Francisco have had a complaint or violation for unpermitted work
  or an illegal unit; 3,303 have one open right now.
- 49% of permitted unit additions completed before 2024, and 29% of permitted bathroom additions, never reached
  the assessor's roll.
- 11% of 2023 to 2025 sales had a prior unpermitted-work complaint.

## Develop

```
npm install
npm run typecheck
```

The Next.js app is scaffolded at milestone M0 (see `plans/CONTRACT.md` §5).

## Not advice

House Checker compares a listing's claims with public City records and flags differences for you and your agent
to investigate. It is not an inspection, appraisal or legal advice. Records can be incomplete, and unpermitted
work may not appear in any record.
