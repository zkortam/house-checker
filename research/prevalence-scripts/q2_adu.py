import sys, os, collections as C, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
ADU_TXT = re.compile(r'\badus?\b|accessory dwelling|\bjadu\b|in-?law unit|secondary unit', re.I)
LEG = {'legaliz': re.compile(r'legali[sz]', re.I),
       'unauthorized/unwarranted/illegal unit': re.compile(r'unauthori[sz]ed|unwarranted|illegal (\w+ )?unit|unpermitted (\w+ )?unit', re.I),
       'comply with nov / nov ref': re.compile(r'compl(y|iance)\s+(w/|with)?\s*(\w+ )?n\.?o\.?v|\bnov\b|notice of violation|abate|complaint\s*#?\s*\d{6}', re.I),
       'existing unit': re.compile(r'\(?e\)?xisting (\w+ ){0,3}(unit|dwelling|adu)|\(e\) ?(\w+ ){0,2}(unit|dwelling|adu)', re.I)}
flag = C.Counter(); flagstat = C.Counter(); txt = C.Counter(); legc = C.Counter(); legyear = C.Counter(); legstat = C.Counter()
adu_permits = []; seen = set()
LU = re.compile(r'legali[sz]\w*\s+(\w+\s+){0,6}(unit|dwelling|in-?law|apartment|adu)|(unit|dwelling|in-?law|apartment|adu)\s+(\w+\s+){0,3}legali[sz]|unauthori[sz]ed unit|unwarranted unit', re.I)
lu_year = C.defaultdict(C.Counter)
for r in rows('permits.csv'):
    if r['permit_number'] in seen: continue  # dataset has one row per address; dedupe on permit_number
    seen.add(r['permit_number'])
    if LU.search(r['description']): lu_year[r['filed_date'][:4]][r['status']] += 1
    isflag = r['adu'] == 'Y'
    istxt = bool(ADU_TXT.search(r['description']))
    if not (isflag or istxt): continue
    y = r['filed_date'][:4]
    if isflag:
        flag[y] += 1; flagstat[r['status']] += 1
    if istxt and not isflag: txt[y] += 1
    if isflag:
        d = r['description']; hit = [k for k, rx in LEG.items() if rx.search(d)]
        for k in hit: legc[k] += 1
        strict = any(k in hit for k in ('legaliz', 'unauthorized/unwarranted/illegal unit', 'comply with nov / nov ref'))
        if strict: legc['STRICT (legaliz|unauth/illegal unit|NOV)'] += 1; legyear[y] += 1; legstat[r['status']] += 1
        if hit: legc['ANY incl. existing-unit'] += 1
        adu_permits.append(dict(pn=r['permit_number'], parcel=pk(r['block'], r['lot']), y=y, status=r['status'], completed=r['completed_date'][:10], e=r['existing_units'], p=r['proposed_units'], strict=strict, hit=hit, addr=f"{r['street_number']} {r['street_name']} {r['street_suffix']}", desc=r['description'][:240]))
# year x status table for flagged
ys = C.defaultdict(C.Counter)
for a in adu_permits: ys[a['y']][a['status']] += 1
out = dict(adu_flag_total=sum(flag.values()), adu_flag_by_filed_year=dict(sorted(flag.items())), adu_flag_by_status=dict(flagstat.most_common()),
           adu_flag_year_x_status={y: dict(v) for y, v in sorted(ys.items())},
           adu_text_only_not_flagged_by_year=dict(sorted(txt.items())),
           legalization_term_counts_among_flagged=dict(legc), strict_legalization_by_year=dict(sorted(legyear.items())), strict_legalization_by_status=dict(legstat.most_common()),
           adu_flag_distinct_parcels=len({a['parcel'] for a in adu_permits}),
           legalize_unit_permits_any_flag_total=sum(sum(v.values()) for v in lu_year.values()), legalize_unit_permits_by_filed_year={y: sum(v.values()) for y, v in sorted(lu_year.items())},
           legalize_unit_permits_by_status=dict(sum(lu_year.values(), C.Counter()).most_common()))
json.dump(adu_permits, open(os.path.join(DATA, 'q2_adu.json'), 'w'))
json.dump(out, open(os.path.join(DATA, '..', 'q2_out.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))
