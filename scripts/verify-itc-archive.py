"""Verify reviewed public protocols and publish a data snapshot (never raw OCR).
Run collect-itc-archive.py first. Changed images/new events require review.json updates.
"""
import hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parent.parent
CANDIDATES=pathlib.Path('/tmp/iron-itc-archive/candidates.json')
a=json.loads(CANDIDATES.read_text());review=json.loads((ROOT/'scripts/itc-review.json').read_text())
if {e['id'] for e in a['events']}!=set(review['events']):raise SystemExit('Archive membership changed: review new protocols before publishing.')
fields=['games','wins','drawZero','drawFish','lossFish','lossZero','catches','opponentCatches','points']
events=[];reports=[]
for e in a['events']:
 patch=review['events'][e['id']]
 if patch['protocolSha256']!=e['protocolSha256']:raise SystemExit('Protocol image changed; previous corrections cannot be reused.')
 rows=[];reviewed_missing={r['place'] for r in patch['extraRows']}
 for line in e['ocrText'].splitlines():
  match=re.match(r'^\s*(\d{1,3})\s+(.+)$',line)
  if not match:continue
  place=int(match[1]);body=match[2]
  if place in reviewed_missing:continue
  split=list(re.finditer(r'(?:(?<=\d)\s*[-–]\s*|\s+[-–]\s+)(?=\S)',body))
  if not split:raise ValueError(f'Unreviewed unparseable row {e["id"]}/{place}')
  at=split[-1];left=body[:at.start()].split();right=body[at.end():].split()
  if len(left)<8 or len(right)<2:raise ValueError('Incomplete protocol row')
  name=' '.join(left[:-7]).lstrip('(—=-|[] ')
  values=left[-7:]+right[:2];corrections=patch['numericCorrections'].get(str(place),{})
  result={'name':patch['nameCorrections'].get(str(place),name),'place':place}
  if e['mode']=='team':result['name']=patch['teamNames'][place-1]
  for key,value in zip(fields,values):
   if key in corrections:result[key]=corrections[key]
   else:
    value=value.strip('|[]()')
    if not value.isdigit():raise ValueError(f'Unreviewed numeric glyph: {e["id"]}/{place}/{key}={value}')
    result[key]=int(value)
  rows.append(result)
 rows.extend(patch['extraRows']);rows.sort(key=lambda r:r['place'])
 if len(rows)!=patch['expectedRows'] or [r['place'] for r in rows]!=list(range(1,patch['expectedRows']+1)):raise ValueError('Not all protocol places were verified')
 for r in rows:
  if r['games']!=sum(r[k] for k in ['wins','drawZero','drawFish','lossFish','lossZero']):raise ValueError(f'Games mismatch {e["id"]}/{r["place"]}')
  if r['points']!=4*r['wins']+2*r['drawFish']+r['lossFish']:raise ValueError(f'Points mismatch {e["id"]}/{r["place"]}')
 if 'publishedCatchTotal' in patch and sum(r['catches'] for r in rows)!=patch['publishedCatchTotal']:raise ValueError('Published catch total does not match extracted rows')
 # The source uses virtual competitors to complete pairs; they are not athletes.
 virtual=[r for r in rows if re.fullmatch(r'ВИ[- ]?\d+',r['name'])]
 actual=[r for r in rows if r not in virtual]
 names=[r['name'].casefold().replace('ё','е') for r in actual]
 if len(set(names))!=len(names):raise ValueError('Duplicate participant names require disambiguation')
 if e['publishedNames']:
  published={p['name'] for p in e['publishedNames']}
  if {r['name'] for r in actual} != published - set(patch.get('publishedCardsWithoutResult', [])):raise ValueError(f'Names mismatch {e["id"]}: protocol-only={set(r["name"] for r in actual)-published}; cards-only={published-set(r["name"] for r in actual)}')
 events.append({k:e[k] for k in ['id','title','date','venue','mode','url','protocolUrl']}|{'organizer':e['organizer'],**({'sourceNote':patch['sourceNote']} if patch.get('sourceNote') else {}),'participants':len(actual),'fieldSize':len(rows),'archiveParticipants':e['participants'],'virtualParticipants':len(virtual),'results':actual})
 reports.append({'id':e['id'],'protocolUrl':e['protocolUrl'],'protocolSha256':e['protocolSha256'],'verifiedRows':len(rows),'realParticipants':len(actual),'excludedVirtual':len(virtual),'archiveParticipants':e['participants'],'catchTotal':sum(r['catches'] for r in rows),'opponentCatchTotal':sum(r['opponentCatches'] for r in rows),'numericChecks':'games and points checked on every row; published catch total checked when present'})
output={'version':1,'source':a['source'],'checkedAt':a['checkedAt'],'events':events}
(ROOT/'public/itc-archive.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
(ROOT/'scripts/itc-report.json').write_text(json.dumps({'checkedAt':a['checkedAt'],'events':reports},ensure_ascii=False,indent=2)+'\n')
print('Verified',len(events),'events,',sum(e['participants'] for e in events),'real participant results.',flush=True)
