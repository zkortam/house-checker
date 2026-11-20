# usage: verify.py <outdir> <parcel>...   -- pulls raw live records for each parcel from DataSF and prints a condensed view
import sys, json, urllib.request, urllib.parse, os
def q(ds, **p):
    url = f'https://data.sf.gov/resource/{ds}.json?' + urllib.parse.urlencode(p)
    return json.load(urllib.request.urlopen(url, timeout=120))
out = sys.argv[1]
for par in sys.argv[2:]:
    b, l = (par[:4], par[4:]) if par[4].isdigit() else (par[:5], par[5:])
    d = dict(
      roll=q('wv5m-vpq2', **{'$where': f"parcel_number='{par}' and closed_roll_year in ('2023','2024','2025')", '$select': 'closed_roll_year,property_location,use_definition,property_class_code_definition,number_of_units,number_of_bathrooms,number_of_bedrooms,property_area,year_property_built,current_sales_date', '$order': 'closed_roll_year'}),
      addr=q('ramy-di5m', **{'$where': f"parcel_number='{par}'", '$select': 'address,eas_fullid', '$limit': 20}),
      permits=q('i98e-djp9', **{'$where': f"block='{b}' and lot='{l}'", '$select': 'permit_number,status,filed_date,completed_date,existing_units,proposed_units,adu,description', '$order': 'filed_date DESC', '$limit': 60}),
      complaints=q('gm2e-bten', **{'$where': f"parcel_number='{par}'", '$select': 'complaint_number,date_filed,status,assigned_division,complaint_description', '$order': 'date_filed DESC', '$limit': 60}),
      novs=q('nbtm-fbw5', **{'$where': f"block='{b}' and lot='{l}'", '$select': 'complaint_number,date_filed,status,item,nov_item_description', '$order': 'date_filed DESC', '$limit': 100}))
    json.dump(d, open(os.path.join(out, par + '.json'), 'w'), indent=1)
    print('=' * 20, par, [a['address'] for a in d['addr']][:4])
    for r in d['roll']: print('  ROLL', r['closed_roll_year'], r.get('property_class_code_definition'), 'units', r.get('number_of_units'), 'baths', r.get('number_of_bathrooms'), 'beds', r.get('number_of_bedrooms'), 'area', r.get('property_area'), 'sale', r.get('current_sales_date', '')[:10])
    for r in d['permits'][:25]:
        if r.get('existing_units') != r.get('proposed_units') or r.get('adu') == 'Y' or any(k in r.get('description', '').lower() for k in ('bath', 'unit', 'legal', 'nov', 'adu')):
            print('  PERMIT', r['permit_number'], r['status'], r.get('filed_date', '')[:10], 'done', r.get('completed_date', '')[:10], r.get('existing_units'), '->', r.get('proposed_units'), 'adu', r.get('adu'), '|', r.get('description', '')[:150])
    for r in d['complaints'][:12]: print('  COMPL', r['complaint_number'], r['date_filed'][:10], r['status'], r.get('assigned_division', '')[:20], '|', r.get('complaint_description', '')[-170:].replace('\n', ' '))
    seen = set()
    for r in d['novs']:
        k = r['complaint_number']
        if k in seen: continue
        seen.add(k); items = [x for x in d['novs'] if x['complaint_number'] == k]
        txt = ' || '.join((x.get('item', '') + ': ' + x.get('nov_item_description', ''))[:120] for x in items if x.get('item') or x.get('nov_item_description'))
        print('  NOV', k, r['date_filed'][:10], {x['status'] for x in items}, len(items), 'items |', txt[:330])
