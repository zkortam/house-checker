# Per-parcel public data sweep (research agent, 2026-11-20)

50+ sources tested live on 2162008 (2055 42nd Ave, 37.748372,-122.501112) and 0863007 (57 Carmelita St,
37.769962,-122.434597). Base: `https://data.sf.gov/resource/<id>.json`, SoQL via `curl -G --data-urlencode`.
Point-in-polygon: `intersects(the_geom,'POINT(lon lat)')`. Radius: `within_circle(<col>,lat,lon,m)`.

## Use (parcel- or address-exact)
| Question | Dataset | Join | 2055 42nd / 57 Carmelita |
|---|---|---|---|
| Tenant buyouts | `wmam-7g8d` | `upper(address) like '2055 42ND%'` (string address, "Avenue"/"Street" spelled out) | B200136, 2020-04-08, $75,000, 3 tenants (verified) / none |
| Short-term rental signal | `g8m3-pdis` business registrations, `transient_occupancy_tax=true` | `upper(full_business_address) like ...` | hotel-tax registration since 2023-08-04 (verified) / none. Rows carry personal names: never show them |
| Unit count, faster than assessor | `c5ge-t6pj` land use `resunits` | parcel | 2 / 1 |
| Zoning | `3i4a-hu95` | point | RH-1 / RH-2 |
| Height and bulk | `h9wh-cg3m`, `usp2-teig` (Family Zoning Plan, 2026-06) | point | 40-X / 40-X |
| Special use districts | `5yf5-ms5f` | point | Family and Senior Housing SUD / 4 SUDs |
| Historic district | `63x5-g3m4` | point | none / Duboce Park (Article 10) |
| Lot area, footprint, height | `acdm-wktn` shape; `ynuv-fyni` (`mblr`='SF'+parcel, `hgt_median_m`) | parcel | 3,008 sf, 1,488 sf footprint, 6 m / 3,349 sf, 1,769 sf, 12 m |
| Nearby permits 150 m | `i98e-djp9` `within_circle(location,...)`, upper(description) keywords, dedupe | spatial | 1994 42nd addition (issued 2026-10) |
| Nearby Planning 150 m | `acdm-wktn` within_circle → block||lot list → `qvu5-m3a2`, `y673-d69b`, `tyz3-vt28` | parcel list | 2026-008730PRJ 3327 Quintara: full demolition + new 3-story 2-unit, Submitted 2026-10-02 (verified) |
| Pipeline (unit-changing) | `6jgi-cpb4` | spatial | same project |
| Street-space and curb permits | `b6tj-gt35` (cnn), `fxfq-npa9` (permit_address) | street | none / curb cut 26DW-00035, street-space permit to 2027-01-24 |
| Flood (100-yr storm) | `jzu3-4yxp` | point | no / no (slow, use timeout + retry) |
| Sea level rise | `esku-ejgv`, `6ann-usi8`, `wppz-u2hi` | point | no / no |
| Liquefaction, seismic zones, tsunami | `i4t7-35u3`, `re79-p8j5`, `7p2k-c3z6` | point | no / no |
| Landslide susceptibility | `bna4-itif` `gridcode` (0, III to X) | point | 0 / 7 (verified) |
| Reservoir failure inundation | `7crf-46s6` | point | Sunset North and Sunset South (verified) / none |
| Maher soil area, air pollutant zone | `v5ic-hjgw`, `t65d-x6p8` | point | no / no |
| Fire code violations | `4zuq-2cbe` (`eas_id like '%<eas>%'`) | EAS | exit-path storage 2021, abated / none |
| Fire inspections, liens | `wb4c-6hwj` | address | clean / clean |
| Street trees | `tkzw-k3nq` (`point` is text: use description or lat/lon box) | address | none / city-maintained cherry |
| Parking permit area, sweeping | `i886-hxz9` (blklot); `yhqp-riqs` (cnn + side) | parcel / street | none, Mon 12 to 2 / Area S, Wed 9 to 11 |
| Transit stops, bike network | `i28k-bkz6`, `ygmz-vaxd` | spatial | nearest stop 97 m / Waller neighborway |
| Permit contacts (contractor license) | `3pee-9qhc` | permit_number | for CSLB lookups |
| Community or green benefit district | `c28a-f6gs`, `hyj5-mm3b` | point | none / none |
| Condo lottery, balcony affidavits | `h9dp-7wd4`, `75h8-2zhw` | block/lot | none / none |

## Context only (never attribute to the parcel)
Eviction notices `5cei-gny5`, Rent Board petitions `6swy-cmkq`, appeals `w2ze-eag5`, owner move-in inquiries
`ugv9-ywu3` are published at hundred-block level with block-face points. Don't show them on a report.

## Don't use
- Crime, schools, crashes, CalEnviroScreen and heat vulnerability: excluded for fair housing.
- PIM proxy for the 2026 roll and the Rent Board portal's internal API: undocumented, may break or be unwelcome.
- Treasurer tax bill lookup and the delinquent list: behind Cloudflare. Recorder index: name search only.

## Gotchas
- Socrata catalog API needs `&search_context=data.sf.gov` or it returns 0.
- Sale dates: `current_sales_date` is null in older rolls; base-year jumps in the roll reveal transfers. DataSF and
  PIM disagree for 2162008 (2022-02-09 vs 2025-09-03): show both with sources.
- Several datasets carry personal names (business registrations, permit contacts, recorder). Never repeat them.
- Planning 2022-007735ENF still reads "Under Review" on Planning's live map service too.
