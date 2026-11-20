"""Analyse internal consistency of existing_units / proposed_units in DBI building permits (i98e-djp9).
Usage: python3 -I unit_consistency.py <json files...>
"""
import json, sys, collections

rows = []
for p in sys.argv[1:]:
    with open(p) as f:
        rows.extend(json.load(f))

# dedupe on permit_number, prefer primary address row
by_pn = {}
for r in rows:
    pn = r.get("permit_number")
    if pn not in by_pn or r.get("primary_address_flag") == "Y":
        by_pn[pn] = r
permits = list(by_pn.values())
print("raw rows", len(rows), "unique permits", len(permits))


def num(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return None

for r in permits:
    r["eu"] = num(r.get("existing_units"))
    r["pu"] = num(r.get("proposed_units"))
    r["parcel"] = (r.get("block") or "") + (r.get("lot") or "")

c = collections.Counter()
for r in permits:
    c["total"] += 1
    if r["eu"] is None: c["eu_missing"] += 1
    if r["pu"] is None: c["pu_missing"] += 1
    if r["eu"] is not None and r["pu"] is not None and r["eu"] != r["pu"]: c["unit_change"] += 1
    eu_use = r.get("existing_use") or ""
    if eu_use == "1 family dwelling" and r["eu"] is not None:
        c["use1_with_units"] += 1
        if r["eu"] != 1: c["use1_units_not1"] += 1
    if eu_use == "2 family dwelling" and r["eu"] is not None:
        c["use2_with_units"] += 1
        if r["eu"] != 2: c["use2_units_not2"] += 1
    if eu_use == "2 family dwelling" and r["eu"] is None:
        c["use2_units_missing"] += 1
print(dict(c))

# per-parcel chronology for small residential parcels
byparcel = collections.defaultdict(list)
for r in permits:
    if r["eu"] is not None and r.get("filed_date") and r["eu"] <= 4:
        byparcel[r["parcel"]].append(r)

pc = collections.Counter()
examples = []
for parcel, ps in byparcel.items():
    if len(ps) < 2:
        continue
    ps.sort(key=lambda r: r["filed_date"])
    pc["parcels_2plus"] += 1
    distinct = {r["eu"] for r in ps}
    if len(distinct) > 1:
        pc["parcels_multi_existing"] += 1
    # unexplained transitions: consecutive permits whose existing_units differ, with no
    # unit-changing permit (completed before the later filing) whose proposed == later existing
    unexplained = 0
    for i in range(1, len(ps)):
        a, b = ps[i - 1], ps[i]
        if a["eu"] == b["eu"]:
            continue
        explained = any(
            q["pu"] is not None and q["eu"] != q["pu"] and q["pu"] == b["eu"]
            and (q.get("completed_date") or q.get("issued_date") or "9999") <= b["filed_date"]
            for q in ps[:i]
        )
        if not explained:
            unexplained += 1
    if unexplained:
        pc["parcels_unexplained_flip"] += 1
        if len(examples) < 8:
            examples.append((parcel, [(r["permit_number"], r["filed_date"][:10], r["eu"], r["pu"], r.get("adu")) for r in ps]))
print(dict(pc))
for e in examples:
    print(e)

# staleness after completed ADU / unit-adding permits
ac = collections.Counter()
for parcel, ps in byparcel.items():
    adds = [q for q in ps if q["pu"] is not None and q["pu"] > q["eu"] and q.get("completed_date") and q.get("status") == "complete"]
    for q in adds:
        later = [r for r in ps if r["filed_date"] > q["completed_date"] and r is not q]
        for r in later:
            ac["later_permits"] += 1
            if r["eu"] == q["pu"]:
                ac["reflects_new_count"] += 1
            elif r["eu"] == q["eu"]:
                ac["still_old_count"] += 1
            else:
                ac["other"] += 1
        if q.get("adu") == "Y":
            ac["completed_adu_unitadds"] += 1
print("after completed unit-adding permits:", dict(ac))
