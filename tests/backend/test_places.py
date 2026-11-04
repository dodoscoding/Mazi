import unittest

from mazi.places import cities, gps_degrees, identify, label, lookup, nearest

ISTANBUL_EXIF = {'1': 'N', '2': '(41.0, 0.0, 51.84)', '3': 'E', '4': '(28.0, 58.0, 30.0)'}


class GpsTests(unittest.TestCase):
    def test_pil_rational_strings_become_signed_degrees(self):
        latitude, longitude = gps_degrees(ISTANBUL_EXIF)
        self.assertAlmostEqual(latitude, 41.0144, places=10)
        self.assertAlmostEqual(longitude, 28.975, places=10)
        latitude, longitude = gps_degrees({'1': 'S', '2': '(33.0, 52.0, 4.0)', '3': 'W\x00', '4': '(151.0, 12.0, 36.0)'})
        self.assertAlmostEqual(latitude, -33.867778, places=6)
        self.assertAlmostEqual(longitude, -151.21, places=6)

    def test_malformed_and_null_fixes_are_rejected(self):
        for raw in ({}, {'1': 'N', '2': '(41.0, 0.0, 0.0)'}, {**ISTANBUL_EXIF, '1': 'X'}, {**ISTANBUL_EXIF, '1': ''},
                    {**ISTANBUL_EXIF, '2': '(nan, 0.0, 0.0)'}, {**ISTANBUL_EXIF, '2': '(91.0, 0.0, 0.0)'},
                    {**ISTANBUL_EXIF, '4': 'b\'\\x02\''}, {'1': 'N', '2': '(0.0, 0.0, 0.0)', '3': 'E', '4': '(0.0, 0.0, 0.0)'}, None):
            self.assertIsNone(gps_degrees(raw), raw)

    def test_nearest_snaps_to_a_city_within_100_km(self):
        city = nearest(*gps_degrees(ISTANBUL_EXIF))
        self.assertEqual((city.name, city.country, city.latitude, city.longitude), ('Istanbul', 'TR', 41.1069, 29.0081))
        self.assertEqual(nearest(66.3, 179.9).name, 'Egvekinot')
        self.assertIsNone(nearest(30.0, -40.0))
        self.assertEqual(len(cities()), 7342)


class LookupTests(unittest.TestCase):
    def test_a_city_listed_twice_is_one_place(self):
        self.assertEqual(lookup('Adapazarı')['status'], 'matched')
        self.assertEqual(lookup('adapazari')['city'].population, 286787)

    def test_every_stored_label_reads_back_as_its_city(self):
        for city in cities():
            found = lookup(label(city)).get('city')
            self.assertEqual((found.name, found.region, found.country), (city.name, city.region, city.country), label(city))

    def test_turkish_and_accented_spellings_match(self):
        kyrenia = lookup('girne')
        self.assertEqual(kyrenia['status'], 'matched')
        self.assertEqual((kyrenia['city'].name, kyrenia['city'].country), ('Kyrenia', 'CY'))
        self.assertEqual({lookup(text)['city'].id for text in ('İstanbul', 'istanbul', 'ISTANBUL', ' Istanbul ')},
                         {identify('Istanbul', 'TR')})

    def test_common_names_need_a_country_or_region(self):
        victoria = lookup('Victoria')
        self.assertEqual(victoria['status'], 'ambiguous')
        self.assertEqual([label(city) for city in victoria['candidates']], [
            'Victoria, British Columbia, CA', 'Victoria, Texas, US', 'Victoria, SC',
            'Victoria, Entre Ríos, AR', 'Victoria, La Araucanía, CL'])
        for text, expected in (('Victoria, CA', 'CA'), ('victoria, texas', 'US'), ('Victoria, British Columbia, CA', 'CA')):
            self.assertEqual(lookup(text)['city'].country, expected, text)
        self.assertEqual(label(lookup('Paris, France')['city']), 'Paris, Île-de-France, FR')

    def test_unknown_and_blank_text(self):
        self.assertEqual(lookup('Nowhereville'), {'status': 'missing'})
        self.assertEqual(lookup('Istanbul, US'), {'status': 'missing'})
        self.assertEqual(lookup('  '), {'status': 'empty'})

    def test_identify_folds_spelling_within_a_country(self):
        self.assertEqual(identify('İstanbul', 'TR'), identify('istanbul', 'TR'))
        self.assertIsNotNone(identify('istanbul', 'TR'))
        self.assertIsNone(identify('Istanbul', 'US'))
        self.assertIsNone(identify('Kadıköy Moda', 'TR'))
