from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.missions.tests import LOCMEM, make_player
from apps.spy.models import SpyCategory, SpySettings, SpyWord

URL = "/api/v1/games/spy/config/"


def body(r):
    data = r.json()
    return data["result"] if data.get("is_successful") else data.get("errors", data)


@override_settings(CACHES=LOCMEM)
class SpyTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(make_player("9120007301"))

    def test_the_design_words_are_there_and_served(self):
        self.assertEqual((SpyCategory.objects.count(), SpyWord.objects.count()), (14, 14))
        cfg = body(self.api.get(URL))
        self.assertTrue(cfg["enabled"])
        self.assertEqual((len(cfg["categories"]), len(cfg["words"])), (14, 14))
        airport = next(w for w in cfg["words"] if w["text"] == "فرودگاه")
        self.assertEqual((airport["category"], airport["related"], airport["difficulty"], airport["age"]), ("places", "ایستگاه قطار", 1, 7))
        self.assertEqual(next(c for c in cfg["categories"] if c["id"] == "places"), {"id": "places", "label": "مکان‌ها", "icon": "map-pin"})

    def test_bordino_switches_words_topics_and_adult_words(self):
        SpyWord.objects.filter(text="فرودگاه").update(is_active=False)
        SpyCategory.objects.filter(slug="food").update(is_active=False)
        cfg = body(self.api.get(URL))
        self.assertNotIn("فرودگاه", [w["text"] for w in cfg["words"]])
        self.assertNotIn("places", [c["id"] for c in cfg["categories"]])  # (a topic with no word left is not offered)
        self.assertNotIn("food", {w["category"] for w in cfg["words"]})
        self.assertIn("adult", [c["id"] for c in cfg["categories"]])
        s = SpySettings.objects.get()
        s.adults_allowed, s.enabled = False, False
        s.save()
        cfg = body(self.api.get(URL))
        self.assertFalse(cfg["enabled"])
        self.assertFalse([w for w in cfg["words"] if w["age"] >= 18])
        self.assertNotIn("adult", [c["id"] for c in cfg["categories"]])

    def test_a_topic_name_cannot_carry_markup_and_a_word_is_not_its_own_twin(self):
        for bad in ('<img src=x onerror=alert(1)>', 'غذا & نوشیدنی', 'a"b', "a'b", "a`b"):
            with self.assertRaises(ValidationError):
                SpyCategory.objects.create(slug="bad", name=bad)
        cat = SpyCategory.objects.get(slug="places")
        with self.assertRaises(ValidationError):
            SpyWord.objects.create(category=cat, text="موزه", related="موزه")
        self.assertEqual(SpyWord.objects.create(category=cat, text="موزه", related="گالری").age, 7)

    def test_only_players_read_it_and_reads_are_throttled(self):
        from django.core.cache import cache  # pylint: disable=import-outside-toplevel

        self.assertIn(APIClient().get(URL).status_code, (401, 403))
        cache.clear()
        codes = [self.api.get(URL).status_code for _ in range(61)]
        self.assertEqual((codes[0], codes[-1]), (200, 429))


@override_settings(CACHES=LOCMEM)
class SpyConfigCostTests(TestCase):
    def setUp(self):
        from django.core.cache import cache  # pylint: disable=import-outside-toplevel

        cache.clear()
        self.api = APIClient()
        self.api.force_authenticate(make_player("9120007302"))

    def test_switched_off_it_answers_without_the_bank_and_changes_apply_at_once(self):
        s = SpySettings.objects.get()
        s.enabled = False
        s.save()
        self.assertEqual(body(self.api.get(URL)), {"enabled": False, "categories": [], "words": []})
        s.enabled = True
        s.save()  # (the cached answer goes with the change)
        self.assertEqual(len(body(self.api.get(URL))["words"]), 14)
        SpyWord.objects.filter(text="فرودگاه").first().delete()
        self.assertEqual(len(body(self.api.get(URL))["words"]), 13)

    def test_the_bank_sent_is_capped(self):
        from unittest import mock  # pylint: disable=import-outside-toplevel

        from apps.spy import services  # pylint: disable=import-outside-toplevel

        with mock.patch.object(services, "MAX_WORDS", 5):
            services._changed()  # pylint: disable=protected-access
            self.assertEqual(len(body(self.api.get(URL))["words"]), 5)
