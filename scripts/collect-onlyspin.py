"""Refresh a limited, verified starter library; never scans the whole store.
Usage: PYTHONPATH=/tmp/iron-parser python3 scripts/collect-onlyspin.py
Requires beautifulsoup4 (see requirements-library.txt). HTTPS verification stays enabled.
"""
from concurrent.futures import ThreadPoolExecutor
import datetime
import hashlib
import json
import pathlib
import time
import urllib.request
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://onlyspin.ru'
TIMEZONE = datetime.timezone(datetime.timedelta(hours=3))
CHECKED = datetime.datetime.now(TIMEZONE).date().isoformat()
PAGES = ['/catalog/primanki/', '/catalog/kolebalki/', '/catalog/kolebalki/?PAGEN_1=2',
         '/catalog/voblery/', '/catalog/voblery/?PAGEN_1=2', '/catalog/tsikady/']
CACHE = pathlib.Path('/tmp/iron-onlyspin-cache')
CACHE.mkdir(exist_ok=True)

def fetch(path):
    cache = CACHE / (hashlib.sha256(path.encode()).hexdigest() + '.html')
    if cache.exists() and datetime.datetime.fromtimestamp(cache.stat().st_mtime, TIMEZONE).date().isoformat() == CHECKED:
        return BeautifulSoup(cache.read_text(), 'html.parser')
    time.sleep(0.25)
    with urllib.request.urlopen(BASE + path, timeout=30) as response:
        html = response.read().decode('utf-8')
    cache.write_text(html)
    return BeautifulSoup(html, 'html.parser')

links = {}
for path in PAGES:
    page = fetch(path)
    for a in page.find_all('a', href=True):
        url, title = a['href'], a.get_text(' ', strip=True)
        if url.startswith('/catalog/product/') and title.startswith(('Блесна ', 'Воблер ', 'Цикада ')):
            links.setdefault(url, title)
print('Candidate cards:', len(links), flush=True)
entries, skipped, errors = [], [], []
def collect(pair):
    index, (path, title) = pair
    try:
        page = fetch(path)
        heading = page.select_one('h1')
        heading = heading.get_text(' ', strip=True) if heading else ''
        props = {}
        for item in page.select('.properties-group__item'):
            name, value = item.select_one('[itemprop=name]'), item.select_one('[itemprop=value]')
            if name and value:
                props[name.get_text(' ',strip=True)] = value.get_text(' ',strip=True)
        brand = page.select_one('[itemprop=brand] [itemprop=name]')
        maker = brand.get('content', '') if brand else ''
        model, color = props.get('Модель приманки',''), props.get('Цвет приманки','')
        raw_weight = props.get('Вес приманки, гр','')
        weight = float(raw_weight.replace(',','.')) if raw_weight else None
        lure_type = next((t for prefix,t in [('Блесна ','Блесна'),('Воблер ','Воблер'),('Цикада ','Цикада')] if heading.startswith(prefix)), None)
        raw_type = props.get('Тип приманки','').lower()
        if not lure_type or any(word in raw_type for word in ['силикон','мягк','резин']):
            reason = 'soft_or_unsupported_type'
        elif weight is None:
            reason = 'missing_weight'
        elif not 0 < weight <= 5:
            reason = 'over_5g_or_zero'
        elif not maker or not model or not color:
            reason = 'missing_verified_attributes'
        else:
            reason = None
        if reason:
            skipped.append({'url':BASE+path,'reason':reason,'weight':weight})
        else:
            entries.append({'lure':{'id':'onlyspin-'+hashlib.sha256(path.encode()).hexdigest()[:16],
                'maker':maker,'model':model,'type':lure_type,'weight':weight,
                'color':color,'code':color,'photo':''}, 'source':'Onlyspin','url':BASE+path,'checkedAt':CHECKED})
    except Exception as error:
        errors.append({'url':BASE+path,'error':str(error)})
    if (index+1)%10 == 0:
        print(f'Checked {index+1}/{len(links)}; accepted {len(entries)}',flush=True)

with ThreadPoolExecutor(max_workers=2) as executor:
    list(executor.map(collect, enumerate(links.items())))

# Keep separate URLs for different variants, but remove exact attribute duplicates.
unique = {}
for e in entries:
    l=e['lure']; unique.setdefault(tuple(l[k].casefold() if isinstance(l[k],str) else l[k] for k in ['maker','model','type','weight','color','code']),e)
entries=sorted(unique.values(),key=lambda e:(e['lure']['maker'],e['lure']['model'],e['lure']['weight'],e['lure']['code']))
report={'checkedAt':CHECKED,'catalogPages':[BASE+p for p in PAGES], 'candidates':len(links),'accepted':len(entries),'skipped':skipped,'errors':errors,
        'scope':'Starter selection from six catalogue pages; not the entire store. Soft lures excluded before visiting product pages; only exact product weights 0 < weight <= 5 included. Color field preserves store color/code without inferred color names.'}
(ROOT/'public/lure-library.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
(ROOT/'scripts/onlyspin-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('DONE',len(entries),'accepted,',len(skipped),'skipped,',len(errors),'errors',flush=True)
