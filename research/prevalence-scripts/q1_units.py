# Q1: completed unit-increasing permits vs assessor roll
import sys, os, collections as C, json, pickle
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
roll = {r['parcel_number']: r for r in rows('roll2025.csv')}
hist = {}
for y in range(2014, 2026):
    hist[y] = {r['parcel_number']: (num(r['number_of_units']), num(r['number_of_bathrooms'])) for r in rows(f'roll{y}.csv')}
LIEN = '2025-01-01'
perms = []
for r in rows('permits.csv'):
    e, p = num(r['existing_units']), num(r['proposed_units'])
    if e is None or p is None or p <= e or r['status'] != 'complete' or not r['completed_date']: continue
    r['parcel'] = pk(r['block'], r['lot']); r['e'] = e; r['p'] = p
    perms.append(r)
print('completed unit-increasing permits:', len(perms), 'parcels:', len({r['parcel'] for r in perms}))
# latest completed unit-increase per parcel
latest = {}
for r in perms:
    if r['parcel'] not in latest or r['completed_date'] > latest[r['parcel']]['completed_date']: latest[r['parcel']] = r
def classify(r):
    rr = roll.get(r['parcel'])
    if rr is None: return 'parcel_not_on_2025_roll'
    if 'Condo' in rr['property_class_code_definition'] or 'Timeshare' in rr['property_class_code_definition']: return 'condo_parcel'
    u = num(rr['number_of_units'])
    if u is None: return 'roll_units_blank'
    if u >= r['p']: return 'roll_reflects_new_count'
    if u <= r['e']: return 'roll_shows_old_count_or_lower'
    return 'roll_partially_updated'
res = {}
for scope, filt in (('all', lambda r: True),
                    ('existing_1to4_units', lambda r: 1 <= r['e'] <= 4),
                    ('existing_1to4_adu_or_small_add', lambda r: 1 <= r['e'] <= 4 and r['p'] - r['e'] <= 2)):
    out = {}
    for when, wf in (('completed_before_lien_2025-01-01', lambda d: d < LIEN), ('completed_after_lien', lambda d: d >= LIEN)):
        sel = [r for r in latest.values() if filt(r) and wf(r['completed_date'])]
        cnt = C.Counter(classify(r) for r in sel)
        out[when] = dict(parcels=len(sel), **cnt)
    res[scope] = out
# lag curve: by completion year, share of small-building parcels (non-condo) whose 2025 roll reflects new count
curve = {}
for r in latest.values():
    if not (1 <= r['e'] <= 4): continue
    c = classify(r)
    if c in ('condo_parcel', 'parcel_not_on_2025_roll', 'roll_units_blank'): continue
    y = r['completed_date'][:4]
    curve.setdefault(y, C.Counter())[c] += 1
res['lag_curve_small_bldg_by_completion_year'] = {y: dict(v) for y, v in sorted(curve.items()) if y >= '2010'}
# roll-history check: did the roll change at all between the roll before completion and 2025?
hc = C.Counter()
for r in latest.values():
    if not (1 <= r['e'] <= 4): continue
    y = int(r['completed_date'][:4])
    if y < 2014 or y > 2024: continue
    pre = hist[y].get(r['parcel']); post = hist[2025].get(r['parcel'])
    if not pre or not post or pre[0] is None or post[0] is None: hc['missing'] += 1; continue
    if 'Condo' in roll[r['parcel']]['property_class_code_definition']: hc['condo'] += 1; continue
    hc['increased' if post[0] > pre[0] else ('unchanged' if post[0] == pre[0] else 'decreased')] += 1
    hc[f'pre_roll_equals_permit_existing={pre[0]==r["e"]}'] += 1
res['roll_history_small_bldg_completed_2014_2024'] = dict(hc)
# stale list for demo candidates
stale = []
for r in latest.values():
    if classify(r) == 'roll_shows_old_count_or_lower' and r['completed_date'] < LIEN and 1 <= r['e'] <= 4:
        rr = roll[r['parcel']]
        stale.append(dict(parcel=r['parcel'], permit=r['permit_number'], completed=r['completed_date'][:10], e=r['e'], p=r['p'], adu=r['adu'],
                          roll_units=rr['number_of_units'], roll_baths=rr['number_of_bathrooms'], use=rr['use_definition'], cls=rr['property_class_code_definition'],
                          sale=rr['current_sales_date'][:10], addr=f"{r['street_number']} {r['street_name']} {r['street_suffix']}", desc=r['description'][:200]))
json.dump(stale, open(os.path.join(DATA, 'q1_stale.json'), 'w'), indent=0)
json.dump(res, open(os.path.join(DATA, '..', 'q1_out.json'), 'w'), indent=1)
print(json.dumps(res, indent=1))
