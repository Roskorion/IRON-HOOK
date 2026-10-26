"""Pure factual extractors. No networking or filesystem writes on import."""
import hashlib,re,urllib.parse

def photo(url,base):
    u=urllib.parse.urljoin(base,url or '')
    p=urllib.parse.urlsplit(u)
    return u if p.scheme=='https' and p.hostname==urllib.parse.urlsplit(base).hostname and re.search(r'\.(jpg|jpeg|png|webp)$',p.path,re.I) else ''

def entry(source,url,maker,model,kind,weight,color,image,day):
    return {'lure':{'id':source.lower()+'-'+hashlib.sha256(url.encode()).hexdigest()[:16],
        'maker':maker,'model':model,'type':kind,'weight':weight,'color':color,'code':color,'photo':image},
        'source':source,'url':url,'checkedAt':day}

def parse_japan4you(soup,url,kind,day):
    props={n.get_text(' ',strip=True):n.parent.select_one('.char_value').get_text(' ',strip=True) for n in soup.select('.char_name') if n.parent.select_one('.char_value')}
    raw=props.get('Вес, г','').replace(',','.')
    if not re.fullmatch(r'\d+(?:\.\d+)?',raw):raise ValueError('missing_explicit_weight')
    weight=float(raw)
    if not 0<weight<=5:raise ValueError('weight_over_5g_or_zero')
    name=soup.select_one('[data-product][itemprop=name]')
    name=name.get_text(' ',strip=True) if name else ''
    brand_model=re.search(r'\bTimon\s+(.+)$',name,re.I)
    if not brand_model:raise ValueError('unverified_brand_model')
    model=brand_model.group(1)
    # Only the main product's selector. Recommendation cards have their own
    # selectors and must never inherit the main product's model or weight.
    selector=soup.select_one('select[name=variant]')
    if not selector:raise ValueError('missing_main_variant_selector')
    result=[]
    for option in selector.select('option[value]'):
        color=option.get_text(' ',strip=True);variant=option.get('value')
        if not color or not variant.isdigit():continue
        result.append(entry('Japan4you',url+'?variant='+variant,'Timon',model,kind,weight,color,photo(option.get('data-attachment',''),'https://japan4you.ru/'),day))
    return result

def onlyspin_photo(soup):
    # Product gallery only; a generic [itemprop=image] may select a brand logo.
    for image in soup.select('img.detail-gallery-big__picture'):
        for value in [image.get('data-src',''),image.get('src','')]:
            url=photo(value,'https://onlyspin.ru/')
            if url:return url
    meta=soup.select_one('meta[property="og:image"]')
    return photo(meta.get('content','') if meta else '', 'https://onlyspin.ru/')
