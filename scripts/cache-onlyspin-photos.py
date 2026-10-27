"""Keep verified original Onlyspin photos with the app, including old URL aliases.
Run: python scripts/cache-onlyspin-photos.py (requires Pillow).
Does not change catalogue entries or personal data. Fails before replacing manifest.
"""
import concurrent.futures
import hashlib
import io
import json
import pathlib
import re
import urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / 'public/lure-photos'
DEST.mkdir(exist_ok=True)
rows = json.loads((ROOT / 'public/lure-library.json').read_text())
urls = sorted({r['lure']['photo'] for r in rows if r['source'] == 'Onlyspin' and r['lure']['photo']})

def cache(url):
    original = re.sub(r'/resize_cache/iblock/(.+)/\d+_\d+_[^/]+/', r'/iblock/\1/', url)
    filename = hashlib.sha256(original.encode()).hexdigest()[:24] + pathlib.Path(original).suffix.lower()
    target = DEST / filename
    if not target.exists():
        with urllib.request.urlopen(original, timeout=40) as response:
            if not response.headers.get('Content-Type', '').startswith('image/'):
                raise ValueError('Non-image response: ' + original)
            data = response.read(8 * 1024 * 1024 + 1)
        if len(data) > 8 * 1024 * 1024:
            raise ValueError('Image too large')
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        target.write_bytes(data)
    return url, original, 'lure-photos/' + filename

manifest = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for index, (old, original, local) in enumerate(pool.map(cache, urls), 1):
        manifest[old] = local
        manifest[original] = local
        if index % 25 == 0:
            print(f'Cached {index}/{len(urls)}', flush=True)
(ROOT / 'src/lure-photo-cache.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'Verified {len(urls)} photos; manifest saved.', flush=True)
