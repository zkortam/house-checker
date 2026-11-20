# Prevalence — condensed (research agent, 2026-11-20). Scripts: prevalence/scripts, outputs prevalence/q*_out.json, raw demo records prevalence/data/verify/

Data facts: 2025 roll ≈ copy of 2024 (5 unit changes, 42 bath changes vs normal 200–1,400 / 1,700–6,000); roll sale dates end ~Jun 2025. Permits dataset is one row per address: 1.30M rows, 1.15M distinct permits → dedupe.

1. Unit-adding completed permits: 4,641 parcels. Core (1–4 unit, description confirms add, non-condo), completed <2024: 703 stale vs 741 updated (49% stale); ADU-flagged 61% stale. Lien split: <2025-01-01 804/1,559 (52%); after 195/229 (85%, expected lag). Roll-history check 2015–2023: unit count never rose in 61%.
2. ADUs: 2,637 flagged permits / 2,455 parcels; peak 399 filed 2020, 85 in 2024. Flag misses 2,000+ ADU-mentioning permits. Legalizations 365 (13.8%); 1,914 unit legalizations across all permits (~200/yr 2015–2019).
3. Complaints/NOVs (work w/o permit, beyond scope, illegal unit): 72,747 records 1994–2026, ~3k/yr, 4,495 open. 23% of non-condo residential parcels ever (17% of all 191k); 9.5% NOV-backed; 3,303 residential parcels open now. By type: w/o permit 53,339 (3,388 open); illegal unit 17,478 (1,289 open); beyond scope 10,762 (592 open).
4. Baths: 4,434 SFH with add-bath permit completed 2015–2023 → 29% no bath increase on roll; 479 still ≤1 bath.
5. Sales Jan 2023–Jun 2025 (8,171): 1.6% had a still-open problem at sale (floor); 11% prior unpermitted/illegal-unit complaint; 4.4% NOV-backed.
6. Demo addresses (live-verified):
 1. 998 Burnett Ave (2853009): 2017 illegal in-law complaints → ADU legalization 201802201717 (2019) + add-bath 2023; roll 1 unit/2 bath; sold 2023-08-02.
 2. 1665 North Point St (0460A023): unpermitted remodel/basement complaints 2023-06-02; NOV 202308900 active; SOLD 13 DAYS LATER.
 3. 2080 Silver Ave (5384002): illegal unit/rooftop NOV 201877294 active since 2018; sold 2023; no permits.
 4. 2626 19th Ave (2478032): NOV 201970952 unpermitted ground floor; sold 2022 mid-violation; ADU done 2023; roll 1/1.
 5. 1150 Fell St (1203013): 3rd unit permit 201811206393 done 2020; roll 2 units; sold 2024; 2 NOVs open 2026.
 6. 250 Arleta Ave (6234014): NOV 202428283 (2024-09) open; sold 2024-11-06.
 7. 731 44th Ave (1600004): illegal Airbnb unit 2017 → legalized 201812067642 (2019); roll 1 unit; sold 2023.
 8. 124 Goettingen St (5928002): illegal unit NOV 202307506 open; sold 2024-11.
 Control: 686 Colby St (6112015) — NOV → ADU 2022 → roll updated 2/2.
 2055 42nd Ave = expected lag (completed after lien date).
Caveats: regex text matching (precision spot-checked, recall unknown, esp. pre-2011); complaints = allegations, NOVs = findings; Assessor may not count ADUs as units; 5–10% parcels drop on join; sale date may include non-market transfers.
