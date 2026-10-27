"""Read linked public ITC, WTF and Area Shop archives and prepare OCR candidates for review.
No organizer live feed, unpublished IDs or authentication endpoints are used.
Requires beautifulsoup4, Pillow, numpy, tesseract and Russian traineddata.
Does not publish unreviewed OCR into the app.
"""
import concurrent.futures, datetime, hashlib, html, json, os, pathlib, re, subprocess, urllib.parse, urllib.request
from bs4 import BeautifulSoup
from PIL import Image
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parent.parent
WORK=pathlib.Path('/tmp/iron-itc-archive');WORK.mkdir(exist_ok=True)
BASE='https://msk-trout.ru'
TESSDATA=os.environ.get('ITC_TESSDATA_DIR','/tmp/itc-tessdata')
DAY=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()
def fetch(url,target):
    if target.exists() and datetime.datetime.fromtimestamp(target.stat().st_mtime,datetime.timezone(datetime.timedelta(hours=3))).date().isoformat()==DAY:return target.read_bytes()
    with urllib.request.urlopen(url,timeout=30) as r:data=r.read()
    target.write_bytes(data);return data

def clean_protocol(file):
    # Grid removal is for OCR analysis only; the original source is retained.
    im=Image.open(file).convert('RGBA');bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);a=np.array(bg.convert('L'));ink=a<100
    cols=np.flatnonzero(ink.mean(axis=0)>.65);rows=np.flatnonzero(ink.mean(axis=1)>.8)
    for x in cols:a[:,max(0,x-2):x+3]=255
    for y in rows:a[max(0,y-2):y+3,:]=255
    result=file.with_name(file.stem+'-ocr.png')
    Image.fromarray(np.where(a<100,0,255).astype('uint8')).save(result)
    return result

soup=BeautifulSoup(fetch(BASE+'/arkhiv',WORK/'archive.html'),'html.parser')
events=[]
for card in soup.select('article.mod-troutresultsarchive__card'):
    props={d.dt.get_text(' ',strip=True):d.dd.get_text(' ',strip=True) for d in card.select('dl > div') if d.dt and d.dd}
    if props.get('Организатор') not in ['ITC','WTF','Area Shop']:continue
    a=card.select_one('h3 a[href]');url=urllib.parse.urljoin(BASE,html.unescape(a['href']))
    id=urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)['archive'][0]
    mode='team' if 'Командный' in props.get('Формат','') else 'individual'
    events.append({'id':id,'title':a.get_text(' ',strip=True),'date':datetime.datetime.strptime(props['Дата'],'%d.%m.%Y %H:%M').date().isoformat(),
        'organizer':props['Организатор'],'venue':props.get('Место / водоём',''),'mode':mode,'participants':int(props['Команд' if mode=='team' else 'Спортсменов']),'url':url})

def extract(event):
    id=event['id'];s=BeautifulSoup(fetch(event['url'],WORK/f'event-{id}.html'),'html.parser')
    cards=[]
    for script in s.find_all('script'):
        text=script.get_text();match=re.search(r'const cards\s*=',text)
        if match:cards=json.JSONDecoder().raw_decode(text[match.end():].lstrip())[0];break
    image=next((img for img in s.find_all('img') if img.get('alt')=='Итоговый протокол'),None)
    if not image:raise ValueError(f'No protocol for event {id}')
    image_url=image['src'].split('?')[0]
    if not image_url.startswith(BASE+'/images/troutcalendar-results/archive/'):raise ValueError('Unexpected protocol URL')
    file=WORK/f'protocol-{id}.png';data=fetch(image_url,file)
    image_for_ocr=clean_protocol(file) if event['mode']=='individual' else file
    output=WORK/f'protocol-{id}'
    if not output.with_suffix('.txt').exists() or output.with_suffix('.txt').stat().st_mtime < file.stat().st_mtime:
        subprocess.run(['tesseract',str(image_for_ocr),str(output),'--tessdata-dir',TESSDATA,'-l','rus' if event['mode']=='individual' else 'rus+eng','--psm','6'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print('Prepared',id,event['mode'],event['participants'],'participants',flush=True)
    return {**event,'protocolUrl':image_url,'protocolSha256':hashlib.sha256(data).hexdigest(),'publishedNames':[{'name':c['name'],'number':c['number']} for c in cards],
            'ocrText':output.with_suffix('.txt').read_text()}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:results=list(ex.map(extract,events))
(WORK/'candidates.json').write_text(json.dumps({'source':BASE+'/arkhiv','checkedAt':DAY,'events':results},ensure_ascii=False,indent=2)+'\n')
print('Prepared',len(results),'public archives for verified import. Candidate file:',WORK/'candidates.json',flush=True)
