"""Production relay for the Botkeep Developer API.

The Botkeep API answers ``Disallowed CORS origin`` for third-party origins, so a
browser cannot call ``api.botkeep.cloud`` directly. This function exposes the
same origin-locked contract the preview server uses:

    POST /api/botkeep
    Authorization: Bearer <botkeep api key>
    { "method": "GET", "path": "/workloads", "query": {...},
      "body": {...}, "idempotencyKey": "..." }

The caller's token is forwarded upstream verbatim and is never stored, logged or
written to disk. Only the Python standard library is used, so there is nothing
to install beyond this file.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

UPSTREAM_BASE = "https://api.botkeep.cloud/api/v1/developer"
ALLOWED_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}
MAX_BODY_BYTES = 8 * 1024 * 1024
TIMEOUT_SECONDS = 30

# A key kept in the environment lets the console run without pasting anything.
# It is read here, forwarded upstream and never returned to the browser.
KEY_ENV_NAMES = ("BOTKEEP_API_KEY", "BOTKEEP_KEY", "APIKEY")


def _server_key():
    for name in KEY_ENV_NAMES:
        value = os.environ.get(name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _json_response(start_response, status, payload, extra_headers=None):
    body = json.dumps(payload).encode("utf-8")
    headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Cache-Control", "no-store"),
        ("Content-Length", str(len(body))),
    ]
    headers.extend((extra_headers or {}).items())
    start_response(f"{status} {'OK' if status < 400 else 'Error'}", headers)
    return [body]


def _safe_path(value):
    """Rejects anything that could escape the fixed upstream prefix."""
    if not isinstance(value, str) or not value.startswith("/"):
        return None
    if value.startswith("//") or ".." in value or ":" in value or "\\" in value:
        return None
    if value.rstrip("/").endswith("/api/botkeep"):
        return None
    return value


def app(environ, start_response):
    method = (environ.get("REQUEST_METHOD") or "GET").upper()
    path_info = environ.get("PATH_INFO") or "/api/botkeep"

    if not path_info.startswith("/api/botkeep"):
        return _json_response(start_response, 404, {"detail": "Not found."})

    if method == "OPTIONS":
        return _json_response(start_response, 204, {}, {"Allow": "POST, OPTIONS"})

    if method != "POST":
        return _json_response(
            start_response, 405, {"detail": "Use POST /api/botkeep with a JSON request envelope."}
        )

    authorization = environ.get("HTTP_AUTHORIZATION") or ""
    if not authorization.startswith("Bearer ") or len(authorization.split(" ", 1)[1].strip()) == 0:
        fallback = _server_key()
        authorization = f"Bearer {fallback}" if fallback else ""
    if not authorization:
        return _json_response(
            start_response,
            401,
            {
                "detail": "A valid Botkeep API key is required. Send one from the console "
                f"or set {KEY_ENV_NAMES[0]} in the environment."
            },
        )

    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    if length > MAX_BODY_BYTES:
        return _json_response(start_response, 413, {"detail": "Request body too large."})

    raw = environ["wsgi.input"].read(length) if length else b""
    try:
        envelope = json.loads(raw.decode("utf-8")) if raw else {}
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return _json_response(start_response, 400, {"detail": f"Malformed request envelope: {error}"})

    if not isinstance(envelope, dict):
        return _json_response(start_response, 400, {"detail": "The request envelope must be an object."})

    target_method = str(envelope.get("method") or "GET").upper()
    if target_method not in ALLOWED_METHODS:
        return _json_response(
            start_response,
            400,
            {"detail": "Unsupported method '{}'.".format(envelope.get("method"))},
        )

    target_path = _safe_path(envelope.get("path"))
    if not target_path:
        return _json_response(
            start_response, 400, {"detail": "The envelope needs a relative `path` starting with `/`."}
        )

    query = {
        str(name): str(value)
        for name, value in (envelope.get("query") or {}).items()
        if value is not None and value != ""
    }
    url = f"{UPSTREAM_BASE}{target_path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    headers = {"Accept": "application/json", "Authorization": authorization}
    idempotency_key = envelope.get("idempotencyKey")
    if idempotency_key:
        headers["Idempotency-Key"] = str(idempotency_key)

    data = None
    if envelope.get("body") is not None:
        data = json.dumps(envelope["body"]).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=target_method)

    passthrough = {}
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as upstream:
            payload = upstream.read()
            status = upstream.status
            content_type = upstream.headers.get("Content-Type") or "application/json; charset=utf-8"
            retry_after = upstream.headers.get("Retry-After")
            request_id = upstream.headers.get("X-Request-Id")
    except urllib.error.HTTPError as error:
        payload = error.read()
        status = error.code
        content_type = error.headers.get("Content-Type") or "application/json; charset=utf-8"
        retry_after = error.headers.get("Retry-After")
        request_id = error.headers.get("X-Request-Id")
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return _json_response(
            start_response, 502, {"detail": f"Upstream Botkeep request failed: {error}"}
        )

    if retry_after:
        passthrough["Retry-After"] = retry_after
    if request_id:
        passthrough["X-Botkeep-Request-Id"] = request_id

    response_headers = [
        ("Content-Type", content_type),
        ("Cache-Control", "no-store"),
        ("Content-Length", str(len(payload))),
    ]
    response_headers.extend(passthrough.items())
    start_response(f"{status} Upstream", response_headers)
    return [payload]


# Aliases some serverless runtimes look for (`app` is the WSGI entrypoint).
application = app
