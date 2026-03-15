#!/usr/bin/env python3

import argparse
import base64
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
import uuid


def decode_jwt_payload(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        return {}
    payload = parts[1]
    padding = "=" * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload + padding)
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


def signed_hash(method: str, path: str, ts: str, nonce: str, token: str, integrity: str = "") -> str:
    payload = f"{method.upper()}|{path}|{ts}|{nonce}|{token}|{integrity}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def options(api_base: str, path: str, origin: str):
    request = urllib.request.Request(
        f"{api_base}/api/v1{path}",
        method="OPTIONS",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,x-request-nonce,x-request-timestamp,x-request-signature",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, dict(response.headers)
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers)


def request(api_base: str, method: str, path: str, data=None, token: str = "", sign: bool = False, extra_headers=None):
    url = f"{api_base}/api/v1{path}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    headers = {"Content-Type": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if sign and token:
        ts = str(int(time.time()))
        nonce = str(uuid.uuid4())
        signature = signed_hash(method, f"/api/v1{path}", ts, nonce, token)
        headers["X-Request-Timestamp"] = ts
        headers["X-Request-Nonce"] = nonce
        headers["X-Request-Signature"] = signature

    if extra_headers:
        headers.update(extra_headers)

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            text = response.read().decode("utf-8")
            payload = json.loads(text) if text else {}
            return response.status, payload, dict(response.headers)
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        try:
            payload = json.loads(text) if text else {}
        except Exception:
            payload = {"raw": text}
        return e.code, payload, dict(e.headers)


def main() -> int:
    parser = argparse.ArgumentParser(description="P0 smoke checks for guardian api-gateway")
    parser.add_argument("--api-base", default="http://localhost:8080", help="API base URL (default: http://localhost:8080)")
    parser.add_argument("--admin-key", required=True, help="Admin key for /api/v1/admin/users")
    args = parser.parse_args()

    checks = []

    def record(name: str, ok: bool, detail: str = ""):
        checks.append((name, ok, detail))
        status = "PASS" if ok else "FAIL"
        suffix = f" - {detail}" if detail else ""
        print(f"[{status}] {name}{suffix}")

    try:
        with urllib.request.urlopen(f"{args.api_base}/health") as health_response:
            health_payload = json.loads(health_response.read().decode("utf-8"))
            record("health", health_response.status == 200 and health_payload.get("status") == "ok", f"status={health_payload.get('status')}")
    except Exception as e:
        record("health", False, str(e))
        return 1

    unique = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
    email = f"p0-smoke-{unique}@example.com"
    password = "Test1234!"

    status, _, _ = request(
        args.api_base,
        "POST",
        "/auth/register",
        {
            "email": email,
            "password": password,
            "first_name": "P0",
            "last_name": "Smoke",
            "user_type": "client",
        },
    )
    record("register", status == 201, f"http={status}")

    status, login, _ = request(
        args.api_base,
        "POST",
        "/auth/login",
        {"email": email, "password": password},
    )
    token = login.get("token", "")
    record("login", status == 200 and bool(token), f"http={status}")

    jwt_payload = decode_jwt_payload(token)
    exp_value = jwt_payload.get("exp")
    has_exp = isinstance(exp_value, int) and exp_value > int(time.time())
    record("token_expiry_claim", has_exp, f"exp={exp_value}")

    status, me, _ = request(args.api_base, "GET", "/auth/me", token=token)
    record("me", status == 200 and me.get("email") == email, f"http={status}")

    status, created, _ = request(
        args.api_base,
        "POST",
        "/orders",
        {
            "title": "P0 Smoke Order",
            "description": "P0 smoke flow",
            "required_licenses": [],
            "budget_min": 100,
            "budget_max": 220,
            "latitude": 55.75,
            "longitude": 37.62,
            "start_time": "2026-04-01T10:00:00Z",
            "end_time": "2026-04-01T12:00:00Z",
            "guard_count": 1,
        },
        token=token,
        sign=True,
    )
    order_id = created.get("order_id") or created.get("id") or (created.get("order") or {}).get("id", "")
    record("create_order_signed", status == 201 and bool(order_id), f"http={status}")

    status, _, _ = request(args.api_base, "GET", f"/orders/{order_id}", token=token)
    record("order_details", status == 200, f"http={status}")

    status, _, _ = request(
        args.api_base,
        "POST",
        f"/orders/{order_id}/messages",
        {"text": "p0 smoke message"},
        token=token,
    )
    record("chat_create", status in (200, 201), f"http={status}")

    status, _, _ = request(args.api_base, "GET", f"/orders/{order_id}/messages", token=token)
    record("chat_list", status == 200, f"http={status}")

    status, cancelled, _ = request(args.api_base, "POST", f"/orders/{order_id}/cancel", {}, token=token)
    cancelled_status = (cancelled.get("order") or {}).get("status")
    record("cancel_order", status == 200 and cancelled_status == "cancelled", f"http={status} order.status={cancelled_status}")

    status, _, _ = request(
        args.api_base,
        "GET",
        "/admin/users",
        extra_headers={"X-Admin-Key": args.admin_key},
    )
    record("admin_users_with_key", status == 200, f"http={status}")

    status, _, _ = request(args.api_base, "GET", "/admin/users")
    record("admin_users_without_key", status == 403, f"http={status}")

    status, logout, _ = request(args.api_base, "POST", "/auth/logout", {}, token=token)
    record("logout", status == 200 and logout.get("ok") is True, f"http={status}")

    status, _, _ = request(args.api_base, "GET", "/auth/me", token=token)
    record("token_revoked_after_logout", status == 401, f"http={status}")

    _, allow_headers = options(args.api_base, "/auth/login", "http://localhost:3003")
    allowed_origin = allow_headers.get("Access-Control-Allow-Origin", "")
    record("cors_allowed_localhost", allowed_origin == "http://localhost:3003", f"origin={allowed_origin}")

    _, block_headers = options(args.api_base, "/auth/login", "https://evil.example.com")
    blocked_origin = block_headers.get("Access-Control-Allow-Origin", "")
    record("cors_block_unknown_origin", blocked_origin == "", f"origin={blocked_origin or '<none>'}")

    failed = [name for name, ok, _ in checks if not ok]
    print(f"\nSummary: {len(checks) - len(failed)}/{len(checks)} passed")
    if failed:
        print("Failed checks: " + ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())