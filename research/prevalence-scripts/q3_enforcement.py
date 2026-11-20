import sys, os, collections as C, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
roll = {r['parcel_number']: r for r in rows('roll2025.csv')}
res = {p for p, r in roll.items() if r['use_definition'] in RESID_USE}
res_nocondo = {p for p in res if 'Condominium' not in roll[p]['property_class_code_definition'] and 'Timeshare' not in roll[p]['property_class_code_definition']}
# Unified record per complaint_number: categories, year, parcel, open flags, sources
recs = {}
def rec(cn):
    return recs.setdefault(cn, dict(cats=set(), src=set(), year=None, parcel=None, c_open=False, n_open=False, has_nov=False))
for r in rows('complaints.csv'):
    t = r['complaint_description']; R = rec(r['complaint_number'])
    R['year'] = r['date_filed'][:4]; R['parcel'] = pk(r['block'], r['lot']) or r['parcel_number']
    R['c_open'] = r['status'] == 'Active'; R['c_status_known'] = True
    for k, rx in (('wwp', WWP), ('beyond', BEYOND), ('unit', UNIT)):
        if rx.search(t): R['cats'].add(k); R['src'].add('complaint')
for r in rows('novs.csv'):
    t = r['item'] + ' | ' + r['nov_item_description']; R = rec(r['complaint_number'])
    R['has_nov'] = True
    if R['year'] is None: R['year'] = r['date_filed'][:4]
    if R['parcel'] is None: R['parcel'] = pk(r['block'], r['lot'])
    if r['status'] == 'active': R['n_open'] = True
    for k, rx in (('wwp', WWP), ('beyond', BEYOND), ('unit', UNIT)):
        if rx.search(t): R['cats'].add(k); R['src'].add('nov')
hits = {cn: R for cn, R in recs.items() if R['cats']}
out = {}
for k in ('wwp', 'beyond', 'unit', 'any'):
    sel = [R for R in hits.values() if k == 'any' or k in R['cats']]
    by = C.Counter(R['year'] for R in sel)
    openc = sum(1 for R in sel if R['c_open'] or R['n_open'])
    nov = sum(1 for R in sel if R['has_nov'])
    pars = {R['parcel'] for R in sel if R['parcel']}
    out[k] = dict(records=len(sel), still_open=openc, escalated_to_nov=nov, parcels=len(pars),
                  res_parcels=len(pars & res), share_res=round(len(pars & res) / len(res), 4),
                  res_nocondo_parcels=len(pars & res_nocondo), share_res_nocondo=round(len(pars & res_nocondo) / len(res_nocondo), 4),
                  open_res_parcels=len({R['parcel'] for R in sel if (R['c_open'] or R['n_open']) and R['parcel'] in res}),
                  by_year={y: by[y] for y in sorted(by) if y and y >= '1994'},
                  open_by_year=dict(sorted(C.Counter(R['year'] for R in sel if R['c_open'] or R['n_open']).items())))
out['denominators'] = dict(res_parcels=len(res), res_nocondo=len(res_nocondo))
# any complaint at all (context)
allp = {R['parcel'] for R in recs.values() if R['parcel']}
out['any_dbi_complaint_share_res_nocondo'] = round(len(allp & res_nocondo) / len(res_nocondo), 4)
json.dump(out, open(os.path.join(DATA, '..', 'q3_out.json'), 'w'), indent=1)
json.dump({cn: dict(R, cats=sorted(R['cats']), src=sorted(R['src'])) for cn, R in hits.items()}, open(os.path.join(DATA, 'q3_hits.json'), 'w'))
print(json.dumps(out, indent=1))
