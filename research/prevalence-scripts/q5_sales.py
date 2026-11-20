# Q5: parcels sold recently (per assessor current_sales_date) with open enforcement / unit / bath mismatch at time of sale
import sys, os, collections as C, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
roll = {r['parcel_number']: r for r in rows('roll2025.csv')}
res = {p for p, r in roll.items() if r['use_definition'] in RESID_USE}
sales = C.defaultdict(set)
for y in range(2021, 2026):
    for r in rows(f'roll{y}.csv'):
        d = r['current_sales_date'][:10]
        if d >= '2021-01-01' and r['parcel_number'] in res: sales[r['parcel_number']].add(d)
WIN = ('2023-01-01', '2025-06-30')
# Enforcement: NOV items (per complaint) still active today; complaint (WWP/beyond/unit) still active today
hits = json.load(open(os.path.join(DATA, 'q3_hits.json')))
open_nov = C.defaultdict(list)   # parcel -> [(date, complaint_no)]
for r in rows('novs.csv'):
    if r['status'] == 'active':
        open_nov[pk(r['block'], r['lot'])].append((r['date_filed'][:10], r['complaint_number']))
open_cat = C.defaultdict(list); any_cat = C.defaultdict(list)
for cn, R in hits.items():
    if (R['c_open'] or R['n_open']) and R['parcel']: open_cat[R['parcel']].append((None, cn, tuple(R['cats'])))
    if R['parcel']: any_cat[R['parcel']].append((cn, R['has_nov']))
cdate = {r['complaint_number']: r['date_filed'][:10] for r in rows('complaints.csv')}
for r in rows('novs.csv'): cdate.setdefault(r['complaint_number'], r['date_filed'][:10])
stale = {s['parcel']: s for s in json.load(open(os.path.join(DATA, 'q1_stale.json')))}
# bath lag: add-bath permit completed 2015-2023 whose roll bath count did not increase from roll(Y-1) to 2025
ADDBATH = re.compile(r'\bnew (full |half |1/2 |3/4 |master |powder )?(bath|bathroom|powder)|\badd(ing|ed|ition of)? (an? |one |1 |new |2nd |second |third |another |extra )?(full |half |1/2 |3/4 |new |master )?(bath|bathroom|powder)|\(n\) ?(full |half |1/2 )?(bath|bathroom|powder)', re.I)
hb = {y: {r['parcel_number']: num(r['number_of_bathrooms']) for r in rows(f'roll{y}.csv')} for y in range(2014, 2026)}
bathlag = {}
for r in rows('permits.csv'):
    if r['status'] != 'complete' or not r['completed_date'] or not ADDBATH.search(r['description']): continue
    p = pk(r['block'], r['lot']); y = int(r['completed_date'][:4])
    if p not in res or not 2015 <= y <= 2023 or 'Condo' in roll[p]['property_class_code_definition']: continue
    a, b = hb[y - 1].get(p), hb[2025].get(p)
    if a is not None and b is not None and b <= a: bathlag[p] = dict(permit=r['permit_number'], completed=r['completed_date'][:10], pre=a, post=b)
json.dump(bathlag, open(os.path.join(DATA, 'q5_bathlag.json'), 'w'))
cnt = C.Counter(); examples = []
sold = [(p, d) for p, ds in sales.items() for d in ds if WIN[0] <= d <= WIN[1]]
for p, d in sold:
    f = []
    nov_before = [x for x in open_nov.get(p, []) if x[0] < d]
    cat_before = [(cdate.get(cn, '9999'), cn, c) for _, cn, c in open_cat.get(p, []) if cdate.get(cn, '9999') < d]
    if nov_before: f.append('open_NOV_any')
    if cat_before: f.append('open_WWP/beyond/illegal-unit')
    if p in stale and stale[p]['bucket'] == 'A' and stale[p]['completed'] < d: f.append('unit_count_stale')
    if p in bathlag and bathlag[p]['completed'] < d: f.append('bath_count_lag')
    for k in f: cnt[k] += 1
    hist_before = [cn for cn, hn in any_cat.get(p, []) if cdate.get(cn, '9999') < d]
    if hist_before: cnt['context:any_WWP/beyond/unit_complaint_before_sale_open_or_closed'] += 1
    if any(hn for cn, hn in any_cat.get(p, []) if cdate.get(cn, '9999') < d): cnt['context:...of_which_escalated_to_NOV'] += 1
    after = [cn for cn, hn in any_cat.get(p, []) if d <= cdate.get(cn, '0000') <= str(int(d[:4]) + 1) + d[4:]]
    if after: cnt['context:WWP/beyond/unit_complaint_within_12mo_after_sale'] += 1
    if f: cnt['ANY'] += 1
    if f and len(f) >= 1: examples.append(dict(parcel=p, sale=d, flags=f, nov=nov_before[:5], cat=cat_before[:5], stale=stale.get(p), bath=bathlag.get(p)))
out = dict(window=WIN, residential_sale_events=len(sold), distinct_parcels=len({p for p, _ in sold}), flagged=dict(cnt),
           share_any=round(cnt['ANY'] / len(sold), 4))
json.dump(examples, open(os.path.join(DATA, 'q5_examples.json'), 'w'))
json.dump(out, open(os.path.join(DATA, '..', 'q5_out.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))
