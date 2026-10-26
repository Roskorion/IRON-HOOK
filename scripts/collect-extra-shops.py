"""Limited verified selections from Japan4you and Baita (HTTPS, two workers).
Run with dependencies from requirements-library.txt; leaves other sources intact.
Only facts, exact variant links and external product-image URLs are retained.
"""
from concurrent.futures import ThreadPoolExecutor
import datetime, hashlib, html, json, pathlib, re, time, urllib.parse, urllib.request
from bs4 import BeautifulSoup
from shop_parsers import photo, entry, parse_japan4you
ROOT=pathlib.Path(__file__).resolve().parent.parent
ZONE=datetime.timezone(datetime.timedelta(hours=3))
DAY=datetime.datetime.now(ZONE).date().isoformat()
CACHE=pathlib.Path('/tmp/iron-extra-shops');CACHE.mkdir(exist_ok=True)

def get(url):
    file=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
    if file.exists() and datetime.datetime.fromtimestamp(file.stat().st_mtime,ZONE).date().isoformat()==DAY:
        return BeautifulSoup(file.read_text(),'html.parser')
    time.sleep(.3)
    with urllib.request.urlopen(url,timeout=30) as r: text=r.read().decode('utf-8')
    file.write_text(text)
    return BeautifulSoup(text,'html.parser')

jobs=[]
for cat,kind,limit in [('krenk','Кренк',6),('minnou','Воблер',3),('viby','Виб',6),('blesny','Блесна',6)]:
    base='https://japan4you.ru/'
    page=get(base+'catalog/'+cat);seen=set()
    for a in page.select('a.js-product-link[href]'):
        u=urllib.parse.urljoin(base,a['href']).split('?')[0]
        if '/products/' not in u or u in seen:continue
        seen.add(u);jobs.append(('Japan4you',u,kind))
        if len(seen)>=limit:break

# Baita model pages list variants, but weights are checked on each selected product.
for model in ['rodio-craft-moca-2-hooks-dr-ss','valkein-hi-burst','valkein-shine-ride-nano',
              'daiwa-presso-double-clutch-60f1','valkein-li-worm-nano','rodio-craft-moca-fat-jr-dr-ss']:
    page=get('https://baita.ru/model/'+model+'/');seen=set()
    for a in page.select('a.product-card__name[href]'):
        u=a['href']
        if not u.startswith('https://baita.ru/product/') or u in seen:continue
        seen.add(u);jobs.append(('Baita',u,None))
        if len(seen)>=8:break

skipped,errors=[],[]
def collect(job):
    source,url,kind=job
    try:
        s=get(url);result=[]
        if source=='Japan4you':
            result=parse_japan4you(s,url,kind,DAY)
        else:
            props={p.select_one('.product-attribute__label').get_text(' ',strip=True).rstrip(':'):p.select_one('.product-attribute__value').get_text(' ',strip=True) for p in s.select('.product-attribute') if p.select_one('.product-attribute__label') and p.select_one('.product-attribute__value')}
            raw=props.get('Вес, г','').replace(',','.')
            if not re.fullmatch(r'\d+(?:\.\d+)?',raw):raise ValueError('missing_explicit_weight')
            weight=float(raw)
            if not 0<weight<=5:raise ValueError('weight_over_5g_or_zero')
            product=None
            for script in s.find_all('script',type='application/ld+json'):
                try:d=json.loads(script.get_text())
                except ValueError:continue
                if isinstance(d,dict) and d.get('@type')=='Product':product=d;break
            if not product:raise ValueError('missing_product_metadata')
            maker=product.get('brand',{}).get('name','')
            group=product.get('isVariantOf',{}).get('name','')
            if not maker or not group.casefold().startswith(maker.casefold()+' '):raise ValueError('missing_brand_model')
            model=group[len(maker):].strip();color=props.get('Цвет','')
            if not color:
                # Some cards expose the exact color only in the heading.
                parts=[part.strip() for part in s.h1.get_text(' ',strip=True).split(',')[1:]]
                if parts and re.fullmatch(r'\d+(?:[.,]\d+)?\s*гр?\.?',parts[0]):parts=parts[1:]
                color=', '.join(parts).lstrip('#').strip()
            if not color:raise ValueError('missing_color')
            kind_raw=props.get('Тип приманки','').lower();title=s.h1.get_text(' ',strip=True)
            if re.search(r'crank|кренк|крэнк',kind_raw):kind='Кренк'
            elif title.startswith(('Раттлин','Ратлин')):kind='Раттлин'
            elif title.startswith('Виб'):kind='Виб'
            elif title.startswith('Цикада'):kind='Цикада'
            elif 'блесна' in title.lower():kind='Блесна'
            elif title.startswith('Воблер'):kind='Воблер'
            else:raise ValueError('unverified_hard_lure_type')
            image=s.select_one('img.wp-post-image')
            image=photo(image.get('src','') if image else product.get('image',''),url)
            result.append(entry(source,url,maker,model,kind,weight,html.unescape(color),image,DAY))
        if not result:raise ValueError('no_variants')
        print(source,url.split('/')[-2] if source=='Baita' else url.split('/')[-1],len(result),'accepted',flush=True)
        return result
    except ValueError as e:
        skipped.append({'url':url,'reason':str(e)});print('SKIP',url,str(e),flush=True);return []
    except Exception as e:
        errors.append({'url':url,'error':str(e)});print('ERROR',url,str(e),flush=True);return []
with ThreadPoolExecutor(max_workers=2) as executor: entries=[e for group in executor.map(collect,jobs) for e in group]
# Source/variant URLs are stable identities; no guessed matches across stores.
entries=list({e['lure']['id']:e for e in entries}.values())
report={'checkedAt':DAY,'selection':'21 Japan4you products and up to 8 variants from each of 6 Baita models. Not the entire shops.',
        'accepted':len(entries),'bySource':{s:sum(e['source']==s for e in entries) for s in ['Japan4you','Baita']},'skipped':skipped,'errors':errors}
(ROOT/'scripts/extra-shops-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if errors:raise SystemExit('Network errors: report saved, library left unchanged.')
existing=json.loads((ROOT/'public/lure-library.json').read_text())
combined=[e for e in existing if e['source'] not in ['Japan4you','Baita']]+entries
combined.sort(key=lambda e:(e['lure']['maker'].casefold(),e['lure']['model'].casefold(),e['lure']['weight'],e['lure']['code'],e['source']))
(ROOT/'public/lure-library.json').write_text(json.dumps(combined,ensure_ascii=False,indent=2)+'\n')
print('DONE',report['bySource'],'total',len(combined),flush=True)
