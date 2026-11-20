# Q1 (refined): completed unit-increasing permits vs latest assessor roll, with timing buckets and description check
import sys, os, collections as C, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
UNITDESC = re.compile(r'\badus?\b|\bjadu\b|accessory dwelling|\bunits?\b|dwelling|in-?law|legali[sz]|apartment|duplex|\bflats?\b|2nd unit|second unit|secondary|ord(inance)?\.? ?#? ?(43-14|162-16|95-17)|state adu|renew|final inspection|cfc', re.I)
roll = {r['parcel_number']: r for r in rows('roll2025.csv')}
hist = {y: {r['parcel_number']: num(r['number_of_units']) for r in rows(f'roll{y}.csv')} for y in range(2014, 2026)}
latest = {}; tot = 0; badesc = 0
for r in rows('permits.csv'):
    e, p = num(r['existing_units']), num(r['proposed_units'])
    if e is None or p is None or p <= e or r['status'] != 'complete' or not r['completed_date']: continue
    tot += 1
    r['parcel'] = pk(r['block'], r['lot']); r['e'] = e; r['p'] = p; r['descok'] = bool(UNITDESC.search(r['description'])) or r['adu'] == 'Y'
    if r['parcel'] not in latest or r['completed_date'] > latest[r['parcel']]['completed_date']: latest[r['parcel']] = r
def bucket(d):
    if d < '2024-01-01': return 'A_before_2024-01-01 (true staleness)'
    if d < '2025-01-01': return 'B_2024 (before 2025 lien date, but 2025 roll chars not refreshed)'
    return 'C_2025-01-01+ (expected lag)'
def classify(r):
    rr = roll.get(r['parcel'])
    if rr is None: return 'excluded:not_on_2025_roll'
    cls = rr['property_class_code_definition']
    if 'Condo' in cls or 'Timeshare' in cls: return 'excluded:condo'
    u = num(rr['number_of_units'])
    if u is None: return 'excluded:blank'
    if u >= r['p']: return 'updated'
    if u <= r['e']: return 'STALE_old_count'
    return 'partial'
out = dict(completed_unit_increase_permits=tot, parcels=len(latest))
for scope, f in (('all_parcels', lambda r: True), ('small_bldg_1to4_existing', lambda r: 1 <= r['e'] <= 4),
                 ('small_bldg_desc_confirmed', lambda r: 1 <= r['e'] <= 4 and r['descok']),
                 ('small_bldg_desc_confirmed_adu_flag', lambda r: 1 <= r['e'] <= 4 and r['adu'] == 'Y'),
                 ('small_bldg_desc_confirmed_completed_2010plus', lambda r: 1 <= r['e'] <= 4 and r['descok'] and r['completed_date'] >= '2010')):
    t = C.defaultdict(C.Counter)
    for r in latest.values():
        if f(r): t[bucket(r['completed_date'])][classify(r)] += 1
    out[scope] = {b: dict(sorted(v.items())) for b, v in sorted(t.items())}
# Roll-history check: units on roll(Y-1) (before completion) vs 2025 roll, for completions 2015-2023
h = C.Counter()
for r in latest.values():
    if not (1 <= r['e'] <= 4 and r['descok']): continue
    y = int(r['completed_date'][:4])
    if not 2015 <= y <= 2023: continue
    if classify(r).startswith('excluded'): continue
    pre, post = hist[y - 1].get(r['parcel']), hist[2025].get(r['parcel'])
    if pre is None or post is None: h['missing'] += 1; continue
    h['increased' if post > pre else 'not_increased'] += 1
out['history_check_small_desc_2015_2023_unitsRoll(Y-1)_vs_2025'] = dict(h)
stale = []
for r in latest.values():
    if 1 <= r['e'] <= 4 and r['descok'] and classify(r) == 'STALE_old_count':
        rr = roll[r['parcel']]
        stale.append(dict(parcel=r['parcel'], permit=r['permit_number'], completed=r['completed_date'][:10], bucket=bucket(r['completed_date'])[0], e=r['e'], p=r['p'], adu=r['adu'],
                          roll_units=rr['number_of_units'], roll_baths=rr['number_of_bathrooms'], cls=rr['property_class_code_definition'], sale=rr['current_sales_date'][:10],
                          addr=f"{r['street_number']} {r['street_name']} {r['street_suffix']}", desc=r['description'][:220]))
json.dump(stale, open(os.path.join(DATA, 'q1_stale.json'), 'w'), indent=0)
json.dump(out, open(os.path.join(DATA, '..', 'q1_out.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))
