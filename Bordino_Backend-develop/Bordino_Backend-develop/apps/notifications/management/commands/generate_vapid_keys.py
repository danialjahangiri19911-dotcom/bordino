import base64

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Prints a new VAPID key pair for Web Push as backend.env lines (keep the private one secret)."

    def handle(self, *args, **opts):
        from cryptography.hazmat.primitives import serialization  # pylint: disable=import-outside-toplevel
        from cryptography.hazmat.primitives.asymmetric import ec  # pylint: disable=import-outside-toplevel

        key = ec.generate_private_key(ec.SECP256R1())
        private = key.private_numbers().private_value.to_bytes(32, "big")
        public = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()  # noqa: E731
        self.stdout.write(f"VAPID_PUBLIC_KEY={b64(public)}")
        self.stdout.write(f"VAPID_PRIVATE_KEY={b64(private)}")
