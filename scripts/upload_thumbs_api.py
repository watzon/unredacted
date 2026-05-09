#!/usr/bin/env python3
"""Upload thumbnails to R2 via Cloudflare REST API."""
import os, sys, json, requests
from pathlib import Path

TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
ACCT = "f4f77153b832ba3fa43a352e21b78310"
BUCKET = "unredacted-pdfs"
THUMB_DIR = Path("/tmp/unredacted-thumbs")

if not TOKEN:
    print("Set CLOUDFLARE_API_TOKEN")
    sys.exit(1)

thumbs = sorted(THUMB_DIR.glob("*.png"))
print(f"Uploading {len(thumbs)} thumbnails to R2...")

headers = {"Authorization": f"Bearer {TOKEN}"}
ok = fail = 0

for i, thumb in enumerate(thumbs):
    name = thumb.name
    r2_path = f"thumbnails/{name}"
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/r2/buckets/{BUCKET}/objects/{r2_path}"

    with open(thumb, "rb") as f:
        resp = requests.put(url, headers=headers, data=f)

    if resp.status_code in (200, 201):
        ok += 1
    else:
        print(f"  FAIL {name}: {resp.status_code} {resp.text[:100]}")
        fail += 1

    if (i + 1) % 20 == 0:
        print(f"  [{i+1}/{len(thumbs)}] {ok} ok, {fail} fail")

print(f"\nDone: {ok} uploaded, {fail} failed")
