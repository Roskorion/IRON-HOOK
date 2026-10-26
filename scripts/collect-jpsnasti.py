"""Collect factual variant names/weights/color codes from selected public series.
Requires requirements-library.txt. Preserves the other sources in the library.
Copies no descriptions, images, prices, stock status or contact information.
"""
from concurrent.futures import ThreadPoolExecutor
import datetime
import hashlib
import json
import pathlib
import re
import time
import urllib.request
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://www.jpsnasti.ru'
ZONE = datetime.timezone(datetime.timedelta(hours=3))
CHECKED = datetime.datetime.now(ZONE).date().isoformat()
CACHE = pathlib.Path('/tmp/iron-jpsnasti-cache')
CACHE.mkdir(exist_ok=True)
SERIES = [
 ('kolebluchiesya_blesny/kolebluchiesya_blesny_nories_masukurouto_sofia','Блесна'),
 ('kolebluchiesya_blesny/kolebluchiesya_blesny_valkein_hi_burst','Блесна'),
 ('kolebluchiesya_blesny/kolebluchiesya_blesny_yarie__712_dexter','Блесна'),
 ('kolebluchiesya_blesny/kolebluchiesya_blesny_velvet_arts_forte','Блесна'),
 ('voblery/voblery_valkein_haze_nano_ss','Воблер'),
 ('voblery/voblery_valkein_juju','Воблер'),
 ('voblery/voblery_nories_pelican_minnow_50f','Воблер'),
 ('cikady/cikady_naburaya_2win','Цикада'),
 ('cikady/cikady_valkein_valcyanom','Цикада'),
 ('cikady/cikady_rodio_craft_shadow_attacker','Цикада'),
]
# Require explicit weight in grams, not a number inferred from a model or URL.
PATTERN = re.compile(r'^(.+?),\s*(\d+(?:[.,]\d+)?)\s*гр?\.?\s*,\s*(.+)$')
PREFIX = re.compile(r'^(?:Колеблющаяся блесна|Блесна колеблющаяся|Блесна|Воблер|Цикада)\s+', re.I)

def collect(pair):
    path, kind = pair
    url = BASE + '/primanki/' + path
    cache = CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
    try:
        if cache.exists() and datetime.datetime.fromtimestamp(cache.stat().st_mtime, ZONE).date().isoformat() == CHECKED:
            html=cache.read_text()
        else:
            time.sleep(0.3)
            with urllib.request.urlopen(url,timeout=30) as response:
                html=response.read().decode('utf-8')
            cache.write_text(html)
        soup=BeautifulSoup(html,'html.parser')
        entries, skipped, seen = [], [], set()
        for a in soup.select('.title a[href]'):
            link=a['href']; title=a.get_text(' ',strip=True)
            if not link.startswith(url+'/') or link in seen:
                continue
            seen.add(link)
            match=PATTERN.fullmatch(title)
            brand_match=re.search(r"'brand':\s*'((?:\\.|[^'])*)'",a.get('onclick',''))
            if not match or not brand_match:
                skipped.append({'url':link,'reason':'missing_explicit_attributes'})
                continue
            name, raw_weight, color=match.groups()
            weight=float(raw_weight.replace(',','.'))
            maker=brand_match.group(1).replace("\\'", "'")
            name=PREFIX.sub('',name)
            if not name.casefold().startswith(maker.casefold()+' '):
                skipped.append({'url':link,'reason':'brand_model_mismatch'})
                continue
            model=name[len(maker):].strip()
            if not 0<weight<=5:
                skipped.append({'url':link,'reason':'over_5g_or_zero','weight':weight})
                continue
            entries.append({'lure':{'id':'jpsnasti-'+hashlib.sha256(link.encode()).hexdigest()[:16],
                'maker':maker,'model':model,'type':kind,'weight':weight,'color':color,'code':color,'photo':''},
                'source':'Japsnasti','url':link,'checkedAt':CHECKED})
        if not seen:
            raise ValueError('No variant rows found; inspect the page structure or series URL')
        print(path.split('/')[-1],len(entries),'accepted /',len(seen),'rows',flush=True)
        return entries,skipped,{'url':url,'variantRows':len(seen)},None
    except Exception as error:
        print('ERROR',url,str(error),flush=True)
        return [],[],None,{'url':url,'error':str(error)}

with ThreadPoolExecutor(max_workers=2) as executor:
    results=list(executor.map(collect,SERIES))
entries=[e for result in results for e in result[0]]
# Keep one factual variant per source/attribute combination.
unique={}
for e in entries:
    l=e['lure']; unique.setdefault(tuple(l[k].casefold() if isinstance(l[k],str) else l[k] for k in ['maker','model','type','weight','color','code']),e)
entries=list(unique.values())
report={'checkedAt':CHECKED,'accepted':len(entries),'series':[r[2] for r in results if r[2]],
        'skipped':[s for r in results for s in r[1]],'errors':[r[3] for r in results if r[3]],
        'scope':'Selected hard-lure series only, not the entire shop. Each record has explicit grams and color in its variant title; exact variant URL is retained. Weight >5g excluded; soft-lure categories not visited.'}
(ROOT/'scripts/jpsnasti-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if report['errors']:
    raise SystemExit('Some series failed: report saved; library left unchanged. Correct the diagnosis before retrying.')
existing=json.loads((ROOT/'public/lure-library.json').read_text())
combined=[e for e in existing if e['source']!='Japsnasti']+entries
combined.sort(key=lambda e:(e['lure']['maker'].casefold(),e['lure']['model'].casefold(),e['lure']['weight'],e['lure']['code'],e['source']))
(ROOT/'public/lure-library.json').write_text(json.dumps(combined,ensure_ascii=False,indent=2)+'\n')
print('DONE',len(entries),'Japsnasti variants;',len(combined),'total',flush=True)
