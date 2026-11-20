import json, sys
hp = json.load(open(sys.argv[1])); asr = {r['parcel_number']: r for r in json.load(open(sys.argv[2]))}
agg = {}
for r in hp:
    bl = r['blocklot']; agg.setdefault(bl, []).append(r)
n = match = lower = higher = missing = 0
for bl, rs in agg.items():
    if bl not in asr: missing += 1; continue
    exp = max(int(float(x.get('proposed_units') or 0)) for x in rs)
    u = int(float(asr[bl].get('number_of_units') or 0))
    n += 1
    if u == exp: match += 1
    elif u < exp: lower += 1
    else: higher += 1
print(f"parcels with unit-adding completions in 2023 (<=4 units): {n}; 2025 roll units == permit proposed: {match}; roll lower: {lower}; roll higher: {higher}; not in roll: {missing}")
