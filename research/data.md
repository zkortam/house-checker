# DataSF data feasibility — condensed (research agent, 2026-11-20). Scripts: data-research/scripts; raw: data-research/downloads

## Key conclusions
1. Assessor unit count is NOT a detector: legal unit additions completed 2018–19 → only 37% reflected on 2025 roll; 2023 → 21%. Decide units from permits + unit certificates (j67f-aayr) + Housing Production (xdht-4php adu_legalization_units).
2. Latest roll = closed_roll_year 2025, lien date 2025-01-01, loaded 2026-06-26; next ~mid-2027. Sales appear 1–2 rolls late.
3. Bedrooms: 0 = unknown; filled for 47% SFH (76% if sold 2015+). Baths/sqft ~99% filled but stale. Condos often units=0.
4. Baths come from plumbing/electrical permits: old system plumbing a6aw-rudh, electrical ftty-kx6y; since 2026-09-14 most new ones in PermitSF tyz3-vt28 (NOT in i98e-djp9 — query both). Finals: inspections vckc-dh2h (building), fuas-yurr (plumbing); no electrical inspections dataset.
5. NOV fields (nov_category_description, work_without_permit, additional_work_beyond_permit, expired_permit, unsafe_building, code_violation_desc) live in nbtm-fbw5, not gm2e-bten. HIS NOVs itemized; others one row with narrative in code_violation_desc.
6. Planning: y673-d69b (ENF/PIC records — can be stale, e.g. 2055 42nd 2022-007735ENF still "Under Review – UDU found" after 2025 CFC); qvu5-m3a2 (Planning units + floor area, adu, legalization).
7. Permit unit fields: sort by date and they reconcile. 5.3% of small parcels have unexplained unit change; 40% of later permits restate old count. Build unit timeline chronologically from completed unit-changing permits → CFC → Housing Production. No majority vote.

## Addresses
- 2055 42nd Ave (2162008, RH-1): NOVs 201488731 (2014), 201714481 (2017) illegal in-law, closed 2025-07; ADU 202301190427 CFC 2025-05-16; plumbing PP20240724049 (ADU 2 baths+kitchen, final) + PP20240926192 (2/f 2 baths, final) → 2 units, ~4 baths. Labels: permitted-not-updated, resolved, stale Planning case.
- 57 Carmelita St (0863007, RH-2, Duboce Park historic district): complaint 202665866 (2026-11-17) Active, work_without_permit=Y + beyond permit (over-excavation); 202655072 (2026-04-24) Active, excavation w/o shoring permit; $617k remodel 202510157458 issued not complete; plumbing PP20260427726 3 baths issued; 2016–22 garden-unit history (2016-005791ENF abated). Planning floor area 2,745 vs assessor 1,900. Label: open enforcement.
- 63 Jules Ave (7012006, RH-1): bath 202606163303 final 2026-10-28; plumbing PP20260616648 final; kitchen/bath PP20260527269 no final. CGS landslide zone (SF South quad 2021). Label: permitted-not-updated (won't show on roll until ~2028).

## Gotchas
Blocks like 5335A, lots like T452N — never split parcel by position. Soft-story lots unpadded. Condo base address → up to 2,392 parcels (query all parcels on eas_baseid + lot lineage nqyt-nfmd). Suffix addresses can sit on other parcels. 31% EAS rows lack parcel (use base). 10% old plumbing permits lack block/lot → address fallback. Complaint free text has typos — never parse addresses/dates from it. i98e-djp9 has a row per address → dedupe permit_number. No sale price dataset, no condo conversion data. Rent Board inventory block-level only.

## Query plan (data.sf.gov/resource/<id>.json; B=block, L=lot, P=B||L)
1 ramy-di5m address_number=n AND street_name='NAME' [AND address_number_suffix='S'] → parcels on eas_baseid (+ nqyt-nfmd lineage)
2 wv5m-vpq2 parcel_number='P' order closed_roll_year DESC (report lien date)
3 i98e-djp9 block/lot $limit 5000, dedupe permit_number
4 tyz3-vt28 parcel_number='P'
5 a6aw-rudh block/lot (+ address fallback)   6 ftty-kx6y block/lot
7 vckc-dh2h, fuas-yurr block/lot   8 j67f-aayr building_permit_application in (...)
9 xdht-4php blocklot='P'   10 gm2e-bten block/lot   11 nbtm-fbw5 block/lot or complaint_number in (...)
12 y673-d69b (open: record_type in ('ENF','PIC') AND record_status not like 'Closed%'); qvu5-m3a2
13 beah-shgi block + (lot padded OR unpadded)   14 4zuq-2cbe eas_id
15 context: acdm-wktn blklot, 3tsw-4idn apn
Hazards (ArcGIS query?geometry=lon,lat&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json):
 CGS: services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_{Liquefaction_Zones,Landslide_Zones,Alquist_Priolo_Fault_Zones}/FeatureServer/0
 FEMA: hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28
 SFPUC 100-yr storm flood: DataSF jzu3-4yxp
## Label rules
Claim > assessor: finaled permit (+CFC for units) → permitted-not-updated; issued no final → in progress; no permit evidence → no permit found (confidence up if past NOV mentions illegal unit/UDU/in-law).
Open case: Active complaint, active NOV row, open Planning ENF (flag stale if newer CFC on same issue).
Resolved: closed complaint/NOV followed by permit "comply with NOV #…".
