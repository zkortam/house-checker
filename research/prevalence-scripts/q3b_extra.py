# Q3 extras: NOV-confirmed parcel share, join coverage, open-and-old counts
import sys, os, collections as C, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
roll = {r['parcel_number']: r for r in rows('roll2025.csv')}
res = {p for p, r in roll.items() if r['use_definition'] in RESID_USE}
resnc = {p for p in res if 'Condo' not in roll[p]['property_class_code_definition'] and 'Timeshare' not in roll[p]['property_class_code_definition']}
h = json.load(open(os.path.join(DATA, 'q3_hits.json')))
out = {}
for k in ('wwp', 'beyond', 'unit', 'any'):
    sel = [R for R in h.values() if k == 'any' or k in R['cats']]
    nov = {R['parcel'] for R in sel if R['has_nov']}
    out[k] = dict(nov_confirmed_res_nocondo_parcels=len(nov & resnc), share=round(len(nov & resnc) / len(resnc), 4),
                  open_records_filed_before_2024=sum(1 for R in sel if (R['c_open'] or R['n_open']) and R['year'] and R['year'] < '2024'),
                  complaints_2016_2025_per_year_avg=round(sum(1 for R in sel if R['year'] and '2016' <= R['year'] <= '2025') / 10))
allp = {R['parcel'] for R in h.values()}
out['join_coverage_hit_parcels_found_on_2025_roll'] = round(len(allp & set(roll)) / len(allp), 4)
json.dump(out, open(os.path.join(DATA, '..', 'q3b_out.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))
