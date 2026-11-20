# usage: python3 -I dl.py <dataset_id> <outfile.csv> <select> [where]
import sys, urllib.request, urllib.parse, csv, io
ds, out, sel = sys.argv[1:4]
where = sys.argv[4] if len(sys.argv) > 4 else None
lim = 50000; off = 0; header = None; n = 0
with open(out, 'w', newline='') as f:
    w = csv.writer(f)
    while True:
        p = {'$select': sel, '$limit': lim, '$offset': off, '$order': ':id'}
        if where: p['$where'] = where
        url = f'https://data.sf.gov/resource/{ds}.csv?' + urllib.parse.urlencode(p)
        txt = urllib.request.urlopen(url, timeout=300).read().decode('utf-8')
        rows = list(csv.reader(io.StringIO(txt)))
        if not rows: break
        if header is None:
            header = rows[0]; w.writerow(header)
        body = rows[1:]
        w.writerows(body); n += len(body)
        if len(body) < lim: break
        off += lim
print(ds, n, 'rows ->', out)
