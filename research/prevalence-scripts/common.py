import csv, re, os
DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
csv.field_size_limit(10**8)
def rows(name):
    with open(os.path.join(DATA, name), newline='') as f:
        yield from csv.DictReader(f)
def pk(block, lot):
    b = (block or '').strip().upper(); l = (lot or '').strip().upper()
    if not b or not l: return None
    return b.zfill(4) + l.zfill(3) if b.isdigit() and l[:3].isdigit() else b + l
def num(s):
    try: return float(s)
    except: return None
WWP = re.compile(r'without (a |any |the |benefit of |proper |required |an? )*(building |valid |necessary |required |approved |electrical |plumbing )?permits?|w/o (a |any )?(building |valid )?permits?|no (building )?permits?\b|unpermitted|non-permitted|work w/o|un-permitted', re.I)
BEYOND = re.compile(r'beyond (the )?(scope|permit)|exceed(s|ed|ing)? (the )?(scope|permit)|outside (the )?scope( of)?( the)? (work|permit)|not (covered|included|shown) (by|in|under|on) (the )?(approved )?(permit|plans)', re.I)
UNIT = re.compile(r'illegal\s+(\w+\s+){0,2}(unit|dwelling|in[- ]?law|apartment|suite)|illegal(ly)? (conver|occup)|unwarranted|unauthori[sz]ed\s+(\w+\s+){0,2}(unit|dwelling|apartment)|in[- ]?law (unit|apartment)|unpermitted (\w+ )?(unit|dwelling)|non-?conforming unit|illegal residential|secondary unit without', re.I)
RESID_USE = {'Single Family Residential', 'Multi-Family Residential'}
