# Demo script (captions in demo.mp4, and a voiceover to read live)

The video is recorded from the real app (real mode, real city data, Claude Code CLI on) with Playwright.
Captions are burned in as an overlay; the lines below match them, with a fuller voiceover for a live demo.
Re-record with the app running on :3000: install Playwright 1.64.1 outside the repo, then
`node submission/tools/record.mjs <outDir> desktop` and `... mobile` (the scripts point at a locally cached
chromium-headless-shell; adjust `EXE`), and stitch with the ffmpeg command at the end. `shots.mjs` makes the
four screenshots. Times below are approximate.

| Time | Screen | Caption | Voiceover |
|---|---|---|---|
| 0:00 | Start page | House Checker: paste a San Francisco listing, get what the city's records say about it. | Buying a home in San Francisco, the listing is the seller's story. The city's records are the other story. |
| 0:04 | Start page | 23% of SF homes have had a complaint for unpermitted work. The listing won't tell you which. | Nearly a quarter of homes have had a complaint for unpermitted work, and half of legal unit additions never reached the assessor. |
| 0:08 | Live steps, 57 Carmelita St | Live steps: 15+ city datasets read in parallel, real counts, nothing invented. | I paste a listing. The agent finds the parcel and reads permits, complaints, Planning, buyouts and hazard maps, live. |
| 0:12 | Verdict | Verdict in plain words, with every claim cited to a city record. | "Get it checked before you offer": two active complaints about excavation, a remodel not signed off, and no permit for the garden in-law. |
| 0:16 | Tiles | At a glance: legal units, open cases, monthly tax, tenants, hazards, room to grow. | Six tiles a first-time buyer can read in five seconds. |
| 0:20 | Good news / Worth a look | Good news and what is worth a look, one line each. | |
| 0:23 | Ask before you offer | The agent picks the cheapest way to settle each unknown: the agent, the city, or a specialist. | For each unknown the agent decides who can answer it most cheaply. |
| 0:27 | Request a visit | Only a site visit can say whether the excavation is sound, so it proposes a structural engineer. | Documents can't tell you if the digging is safe, so it proposes a structural engineer, scoped to the two complaints. |
| 0:31 | Confirm dialog | Outward-facing, so it asks first: who, when, scope and price. | It never acts on its own: who, when, scope and price, then I confirm. |
| 0:34 | Sent | Request email with a calendar invite sent to the specialist (demo outbox). | |
| 0:37 | Email dialog | Questions drafted from the findings: the complaints, the permits, the garden in-law. | It drafts the listing agent the exact questions, with the record numbers. |
| 0:42 | Undo toast | Held for 5 seconds with Undo, then sent once (idempotent). | |
| 0:49 | Listing vs City | Listing vs City: big values side by side, so mismatches jump out. | |
| 0:53 | Costs | True cost to own at your price, plus $152 a month while complaints stay open. | Taxes at my price, and the monitoring fees an open complaint carries to the next owner. |
| 0:59 | What you sent | The audit trail: every action the agent took, kept with the report. | Everything it did is logged with the report. |
| 1:03 | 2055 42nd Ave steps | No false alarms: the assessor says 1 unit and 1 bath. Permits say otherwise. | Now a house that looks bad on paper. |
| 1:08 | Verdict | "Looks solid": the in-law was legalized in 2025 and the tax roll is simply behind. | Permits and a certificate of completion show two legal units and four baths. No false alarm. |
| 1:12 | Source sheet | Every number links to its record: tap a citation, open the city record. | Every claim opens the exact DataSF record. |
| 1:17 | Tiles | Also found: a 2020 tenant buyout, a short-term rental registration, a reservoir zone. | |
| 1:21 | Hazards | Eight hazard maps as one checklist. No crime, school or demographic data. | Fair housing by design. |
| 1:25 | History | History as a timeline. Sources collapsed until you need them. | |
| 1:46 | Phone, 2055 | On a phone: the same report, built for a first-time buyer. | |
| 1:52 | Tiles | Verdict, then six tiles you can tap. / Tap a tile to jump to its section. | |
| 2:05 | Price slider | Price slider: taxes recompute as you move it. | |
| 2:12 | | House Checker. City records, plain words, and the next step taken for you. | |

Stitch command used:
```
ffmpeg -i desktop.webm -i mobile.webm -filter_complex "[0:v]fps=30,scale=1440:900,setsar=1[a];[1:v]fps=30,scale=-2:900,pad=1440:900:(ow-iw)/2:0:color=0x1b1b1f,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" -map "[v]" -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart demo.mp4
```
