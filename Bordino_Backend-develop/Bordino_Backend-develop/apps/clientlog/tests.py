from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.clientlog.models import ClientLog
from apps.wallet.tests import make_customer

LOCMEM = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@override_settings(CACHES=LOCMEM, OPS_OWNERS=["9128007728"])
class ClientLogTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_customer("9120005001")
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_the_app_reports_the_steps_of_an_attempt(self):
        r = self.api.post("/api/v1/client-log/", {"flow": "profile_photo", "attempt": "a1", "env": {"ua": "x", "app": "android"},
                          "events": [{"step": "pick_open", "data": {"via": "gallery"}}, {"step": "decode_failed", "level": "error", "data": {"error": "x" * 9000}}]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        rows = list(ClientLog.objects.order_by("create_time"))
        self.assertEqual([(x.phone, x.step, x.level, x.attempt) for x in rows], [("9120005001", "pick_open", "info", "a1"), ("9120005001", "decode_failed", "error", "a1")])
        self.assertEqual(rows[0].data["env"]["app"], "android")
        self.assertIn("_cut", rows[1].data)  # (a huge step is cut, never refused)

    def test_unknown_flows_and_strangers_are_refused(self):
        self.assertEqual(self.api.post("/api/v1/client-log/", {"flow": "x", "events": []}, format="json").status_code, 400)
        self.assertIn(APIClient().post("/api/v1/client-log/", {"flow": "profile_photo", "events": []}, format="json").status_code, (401, 403))

    def test_the_upload_is_traced_on_the_server_and_staff_can_read_it(self):
        from unittest import mock  # pylint: disable=import-outside-toplevel

        from django.core.files.storage import FileSystemStorage  # pylint: disable=import-outside-toplevel

        # (no file is written in the test container: the storage answers with the name it would use)
        with mock.patch.object(FileSystemStorage, "_save", lambda _self, name, content: name):
            self._upload_traced()

    def _upload_traced(self):
        from io import BytesIO  # pylint: disable=import-outside-toplevel

        from PIL import Image  # pylint: disable=import-outside-toplevel

        buf = BytesIO()
        Image.new("RGB", (64, 64), (10, 20, 30)).save(buf, "JPEG")
        buf.seek(0)
        buf.name = "avatar.jpg"
        r = self.api.patch("/api/v1/customer/profile-image/me/", {"image": buf, "trace_attempt": "a2"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.content)
        steps = list(ClientLog.objects.filter(attempt="a2").order_by("create_time").values_list("step", "source"))
        self.assertEqual(steps, [("server_received", "server"), ("server_saved", "server")])
        bad = self.api.patch("/api/v1/customer/profile-image/me/", {"image": BytesIO(b"not a picture"), "trace_attempt": "a3"}, format="multipart")
        self.assertEqual(bad.status_code, 400)
        self.assertTrue(ClientLog.objects.filter(attempt="a3", step="server_refused", level="error").exists())
        from apps.ops.auth import tokens_for  # pylint: disable=import-outside-toplevel

        owner = make_customer("9128007728")
        ops = APIClient()
        ops.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens_for(owner)['access']}")
        logs = ops.get("/api/v1/ops/client-logs/", {"phone": "09120005001"}).json()["result"]["logs"]
        self.assertEqual(len(logs), 4)
        self.assertIn(self.api.get("/api/v1/ops/client-logs/").status_code, (401, 403))
