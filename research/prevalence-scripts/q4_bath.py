import sys, os, collections as C, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
ADDBATH = re.compile(r'\bnew (full |half |1/2 |3/4 |master |powder )?(bath|bathroom|powder)|\badd(ing|ed|ition of)? (an? |one |1 |new |2nd |second |third |another |extra )?(full |half |1/2 |3/4 |new |master )?(bath|bathroom|powder)|\(n\) ?(full |half |1/2 )?(bath|bathroom|powder)|\bfull bath|bath(room)? addition', re.I)
roll = {r['parcel_number']: r for r in rows('roll2025.csv')}
hist = {y: {r['parcel_number']: num(r['number_of_bathrooms']) for r in rows(f'roll{y}.csv')} for y in range(2014, 2026)}
def ok_parcel(p):
    rr = roll.get(p)
    return rr and rr['use_definition'] == 'Single Family Residential' and rr['property_class_code_definition'] in ('Dwelling',)
latest = {}; nmatch = 0; phrase = C.Counter(); seen = set()
for r in rows('permits.csv'):
    if r['permit_number'] in seen: continue
    seen.add(r['permit_number'])
    if r['status'] != 'complete' or not r['completed_date']: continue
    m = ADDBATH.search(r['description'])
    if not m: continue
    nmatch += 1
    p = pk(r['block'], r['lot'])
    if not ok_parcel(p): continue
    phrase[m.group(0).lower()[:12]] += 1
    r['parcel'] = p; r['strict'] = not m.group(0).lower().startswith('full bath')
    if p not in latest or r['completed_date'] > latest[p]['completed_date']: latest[p] = r
out = dict(completed_addbath_permits_all_parcels=nmatch, sfr_dwelling_parcels_with_one=len(latest))
cnt = C.Counter(); cnt_strict = C.Counter(); byyear = C.defaultdict(C.Counter); lowbath = C.Counter(); examples = []
for p, r in latest.items():
    y = int(r['completed_date'][:4])
    if y < 2015 or y > 2023: continue   # completed before 2024-01-01; pre = roll of year Y-1 (snapshot certainly before completion)
    pre, post = hist[y - 1].get(p), hist[2025].get(p)
    if pre is None or post is None: cnt['missing'] += 1; continue
    k = 'increased' if post > pre else ('unchanged' if post == pre else 'decreased')
    cnt[k] += 1; byyear[y][k] += 1
    if r['strict']: cnt_strict[k] += 1
    if post <= 1: lowbath[k] += 1
    if k != 'increased' and post <= 1 and r['strict']:
        examples.append(dict(parcel=p, permit=r['permit_number'], completed=r['completed_date'][:10], pre=pre, post=post, addr=f"{r['street_number']} {r['street_name']} {r['street_suffix']}", sale=roll[p]['current_sales_date'][:10], desc=r['description'][:200]))
# baseline: share of all SFR dwellings whose bath count changed 2014->2025
base = C.Counter()
for p, rr in roll.items():
    if not ok_parcel(p): continue
    a, b = hist[2014].get(p), hist[2025].get(p)
    if a is None or b is None: continue
    base['increased' if b > a else ('unchanged' if b == a else 'decreased')] += 1
out.update(completed_2015_2023_rollYminus1_vs_2025_roll=dict(cnt), strict_new_or_add_only=dict(cnt_strict), by_completion_year={y: dict(v) for y, v in sorted(byyear.items())},
           where_2025_roll_baths_le_1=dict(lowbath), baseline_all_sfr_dwellings_2014_to_2025=dict(base), top_phrases=phrase.most_common(15))
json.dump(examples, open(os.path.join(DATA, 'q4_examples.json'), 'w'), indent=0)
json.dump(out, open(os.path.join(DATA, '..', 'q4_out.json'), 'w'), indent=1)
print(json.dumps(out, indent=1)); print(len(examples))
