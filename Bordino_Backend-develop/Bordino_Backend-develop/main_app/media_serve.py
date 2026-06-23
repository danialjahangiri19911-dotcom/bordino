import mimetypes
import os
import re

from django.http import HttpResponse
from django.views.static import serve as static_serve

_RANGE_RE = re.compile(r"bytes\s*=\s*(\d+)-(\d*)", re.IGNORECASE)


def serve_media_with_range(request, path, document_root=None, show_indexes=False):
    """Dev-only media serve that honors HTTP Range requests.

    Django's default ``static.serve`` returns the whole file with 200 for a
    Range request and sets no ``Accept-Ranges`` header, which prevents the
    browser from seeking in <audio>/<video>. In production media is served by
    object storage (S3/MinIO) which already supports Range; this shim gives the
    dev server the same behavior.
    """
    full_path = os.path.normpath(os.path.join(document_root, path))
    root = os.path.normpath(document_root)
    if not full_path.startswith(root) or not os.path.isfile(full_path):
        return static_serve(
            request, path, document_root=document_root, show_indexes=show_indexes
        )

    range_header = request.META.get("HTTP_RANGE", "").strip()
    match = _RANGE_RE.match(range_header) if range_header else None
    if not match:
        response = static_serve(
            request, path, document_root=document_root, show_indexes=show_indexes
        )
        response["Accept-Ranges"] = "bytes"
        return response

    size = os.path.getsize(full_path)
    start = int(match.group(1))
    end = int(match.group(2)) if match.group(2) else size - 1
    end = min(end, size - 1)
    if start >= size or start > end:
        response = HttpResponse(status=416)
        response["Content-Range"] = f"bytes */{size}"
        return response

    length = end - start + 1
    with open(full_path, "rb") as f:
        f.seek(start)
        data = f.read(length)

    content_type = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
    response = HttpResponse(data, status=206, content_type=content_type)
    response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Accept-Ranges"] = "bytes"
    response["Content-Length"] = str(length)
    return response
