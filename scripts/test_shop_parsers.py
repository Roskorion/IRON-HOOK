import unittest
from bs4 import BeautifulSoup
from shop_parsers import parse_japan4you

class Japan4youParserTests(unittest.TestCase):
    def page(self,weight='1.6'):
        return BeautifulSoup(f'''<span itemprop="name" data-product="83">Воблер Timon CHIBI PANICRA DR-SS</span>
        <div><div class="char_name">Вес, г</div><div class="char_value">{weight}</div></div>
        <form><select name="variant"><option value="712" data-attachment="files/downloads/red.jpg">Red</option><option value="716" data-attachment="files/downloads/green.png">Green</option></select></form>
        <div class="recommendations"><select name="variant"><option value="999">Other model</option></select></div>''','html.parser')
    def test_recommendations_do_not_inherit_main_product(self):
        entries=parse_japan4you(self.page(),'https://japan4you.ru/products/timon-chibi','Кренк','2026-10-26')
        self.assertEqual(len(entries),2)
        self.assertEqual([e['url'].split('=')[-1] for e in entries],['712','716'])
        self.assertEqual(entries[0]['lure']['model'],'CHIBI PANICRA DR-SS')
        self.assertEqual(entries[0]['lure']['photo'],'https://japan4you.ru/files/downloads/red.jpg')
    def test_weight_boundary(self):
        self.assertEqual(parse_japan4you(self.page('5'),'https://japan4you.ru/products/test','Кренк','2026-10-26')[0]['lure']['weight'],5)
        with self.assertRaises(ValueError):parse_japan4you(self.page('5.01'),'https://japan4you.ru/products/test','Кренк','2026-10-26')


class OnlyspinPhotoTests(unittest.TestCase):
    def test_product_picture_precedes_brand_logo_and_generic_og(self):
        from shop_parsers import onlyspin_photo
        soup=BeautifulSoup('''<img itemprop="image" src="/brand-logo.jpg"><meta property="og:image" content="https://onlyspin.ru/generic.jpg"><img class="detail-gallery-big__picture" src="/upload/variant-450.jpg">''','html.parser')
        self.assertEqual(onlyspin_photo(soup),'https://onlyspin.ru/upload/variant-450.jpg')
    def test_lazy_picture_and_missing_picture(self):
        from shop_parsers import onlyspin_photo
        soup=BeautifulSoup('<img class="detail-gallery-big__picture" src="data:image/gif;base64,x" data-src="/upload/variant.webp">','html.parser')
        self.assertEqual(onlyspin_photo(soup),'https://onlyspin.ru/upload/variant.webp')
        self.assertEqual(onlyspin_photo(BeautifulSoup('<img itemprop="image" src="/brand-logo.jpg">','html.parser')),'')

if __name__=='__main__':unittest.main()
