# Demo script (captions in demo.mp4, and a voiceover to read live)

The video is recorded from the real app (real mode, real city data, Claude Code CLI on) with Playwright.
Captions are burned in as an overlay; the lines below match them, with a fuller voiceover for a live demo.
Re-record with the app running on :3000: install Playwright 1.64.1 outside the repo, then
`node submission/tools/record.mjs <outDir> desktop` and `... mobile` (the scripts point at a locally cached
chromium-headless-shell; adjust `EXE`), and stitch with the ffmpeg command at the end. `shots.mjs` makes the
four screenshots. Times below are approximate.

| ~Time | Screen | Caption | Voiceover |
|---|---|---|---|
| 0:00 | Start page | House Checker: paste a San Francisco listing, get what the city's records say about it. | Buying a home in San Francisco, the listing is the seller's story. The city's records are the other story. |
| 0:04 | Start page, typing | 23% of SF homes have had a complaint for unpermitted work. The listing won't tell you which. | Nearly a quarter of homes have had a complaint for unpermitted work. |
| 0:12 | Live steps, 57 Carmelita St | Live steps: 15+ city datasets read in parallel, real counts, nothing invented. | The agent finds the parcel and reads permits, complaints, Planning, buyouts and hazard maps, live. |
| 0:16 | Satellite + verdict | Verdict in plain words: 0 of 5 listing claims match the city. | "Get it checked before you offer": two active excavation complaints, no permit for the garden in-law, a remodel not signed off. |
| 0:21 | Listing vs City + tax | Listing vs City side by side, and what it really costs to own each month. | |
| 0:25 | Row sheet | Tap any row for the why, with links to the records. | |
| 0:30 | Price slider | Move the price: taxes recompute. | |
| 0:34 | Tiles | At a glance: open cases, tenants, hazards, room to grow. | |
| 0:38 | Ask before you offer | For each unknown, the cheapest way to settle it: the agent, the city, or a specialist. | |
| 0:42 | Request a visit | Only a site visit can say whether the excavation is sound, so it proposes a structural engineer. | |
| 0:46 | Confirm dialog | Outward-facing, so it asks first: who, when, scope and price. | It never acts on its own. |
| 0:50 | Sent | Request email with a calendar invite sent to the specialist (demo outbox). | |
| 0:53 | Email dialog | Questions drafted from the findings: the complaints, the permits, the garden in-law. | |
| 0:59 | Undo toast | Held for 5 seconds with Undo, then sent once (idempotent). | |
| 1:05 | Lower report | Good news, what is worth a look, building systems and a timeline. | |
| 1:09 | Footer | Every action the agent took is logged with the report. | The audit trail. |
| 1:13 | 2055 42nd Ave | No false alarms: the assessor says 1 unit and 1 bath. Permits say otherwise. | Now a house that looks bad on paper. |
| 1:25 | Verdict | "Looks solid": the in-law was legalized in 2025 and the tax roll is simply behind. | Permits and a certificate of completion show two legal units and four baths. |
| 1:30 | Sources | Every number links to its record: open the exact city record. | |
| 1:35 | Report | Also found: a 2020 tenant buyout, a short-term rental registration, a reservoir zone. | |
| 1:39 | Report | Fair housing by design: no crime, school or demographic data. | |
| 1:34 to 2:01 | Phone, 2055 | On a phone: the same report, built for a first-time buyer. / Verdict, then six tiles you can tap. / Tap a tile for the details behind it. / Price slider: taxes recompute as you move it. / House Checker. City records, plain words, and the next step taken for you. | |

Stitch command used:
```
ffmpeg -i desktop.webm -i mobile.webm -filter_complex "[0:v]fps=30,scale=1440:900,setsar=1[a];[1:v]fps=30,scale=-2:900,pad=1440:900:(ow-iw)/2:0:color=0x1b1b1f,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" -map "[v]" -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart demo.mp4
```
