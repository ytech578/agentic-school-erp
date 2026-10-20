"""Synthetic password + existing TOTP acceptance inside an isolated restore.

Runs inside the restored server, uses loopback only, and never follows redirects.
Inputs arrive over stdin, not argv, environment files, or logs.
"""
import base64
import hashlib
import hmac
import http.cookiejar
import json
import re
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class AcceptanceError(Exception):
    pass


def main():
    config = json.load(sys.stdin)
    if not re.fullmatch(r"erp-identity-test-[a-f0-9]+", config["slug"]):
        raise AcceptanceError("Non-synthetic flow")
    if config["email"] != "identity.teacher@erp-identity.invalid":
        raise AcceptanceError("Non-synthetic identity")
    origin = "http://127.0.0.1:9000"
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        NoRedirect(), urllib.request.HTTPCookieProcessor(cookies)
    )

    def request(route, body=None):
        if not route.startswith("/") or route.startswith("//"):
            raise AcceptanceError("Non-local recovery request")
        headers = {"Origin": origin, "Referer": origin + "/"}
        # The test runs inside a network-disabled container namespace. Preserve
        # cookies on this loopback HTTP transport; no remote URLs are accepted.
        headers["Cookie"] = "; ".join(c.name + "=" + c.value for c in cookies)
        csrf = next((c.value for c in cookies if "csrf" in c.name.lower()), None)
        if csrf:
            headers["X-authentik-CSRF"] = urllib.parse.unquote(csrf)
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        req = urllib.request.Request(origin + route, data=data, headers=headers)
        try:
            response = opener.open(req, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        raw = response.read()
        if response.status == 302:
            location = urllib.parse.urlsplit(response.headers.get("Location", ""))
            return response.status, {"redirect": location.path + ("?" + location.query if location.query else "")}
        return response.status, json.loads(raw) if raw.startswith(b"{") else {}

    flow = config["slug"] + "-password"
    request("/if/flow/" + flow + "/")
    executor = "/api/v3/flows/executor/" + flow + "/?query="
    status, challenge = request(executor)
    mfa_seen = False
    missing_denied = False
    authenticated = False
    for _ in range(15):
        if status == 302:
            if challenge.get("redirect", "").startswith("/api/v3/flows/executor/"):
                status, challenge = request(challenge["redirect"])
                continue
            authenticated = True
            break
        if status != 200:
            raise AcceptanceError("Unexpected recovery challenge response HTTP " + str(status))
        component = challenge.get("component")
        if component == "xak-flow-redirect":
            authenticated = True
            break
        body = {"component": component}
        if component == "ak-stage-identification":
            body.update(uid_field=config["email"], password=config["password"])
        elif component == "ak-stage-password":
            body["password"] = config["password"]
        elif component == "ak-stage-authenticator-validate":
            mfa_seen = True
            denied_status, denied = request(executor, body)
            if denied_status == 302 and denied.get("redirect", "").startswith("/api/v3/flows/executor/"):
                denied_status, denied = request(denied["redirect"])
            if denied_status != 200 or denied.get("component") != component or not denied.get("response_errors"):
                raise AcceptanceError("Missing MFA was not denied")
            missing_denied = True
            secret = config["totpSecret"]
            key = base64.b32decode(secret.upper() + "=" * ((8 - len(secret) % 8) % 8))
            digest = hmac.new(key, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
            offset = digest[-1] & 15
            code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
            body["code"] = f"{code:06d}"
        else:
            raise AcceptanceError("Unexpected recovery flow stage")
        status, challenge = request(executor, body)
        if challenge.get("response_errors"):
            raise AcceptanceError("Recovery credentials rejected")
    if not authenticated or not mfa_seen or not missing_denied:
        raise AcceptanceError("Recovery MFA login incomplete")
    status, me = request("/api/v3/core/users/me/")
    if status != 200 or me.get("user", {}).get("email") != config["email"]:
        raise AcceptanceError("Restored session not authenticated")
    print(json.dumps({"restoredPasswordAndTotpLogin": True, "missingMfaDenied": True}))


if __name__ == "__main__":
    try:
        main()
    except AcceptanceError as error:
        print("Isolated recovery login failed: " + str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Isolated recovery login failed; credentials and response bodies withheld", file=sys.stderr)
        sys.exit(1)
