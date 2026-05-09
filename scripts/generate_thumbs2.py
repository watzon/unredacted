#!/usr/bin/env python3
"""Generate thumbnails: extract page 1 of each PDF, upload to R2."""
import subprocess, os
from pathlib import Path

PDF_DIR = Path("/mnt/downloads-cache/war-ufo/pdfs")
THUMB_DIR = Path("/tmp/unredacted-thumbs")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
THUMB_DIR.mkdir(exist_ok=True)

pdfs = sorted(PDF_DIR.glob("*.pdf"))
print(f"Phase 1: Extracting page 1 from {len(pdfs)} PDFs...")

# Extract all thumbnails locally first (fast)
ok = fail = 0
for i, pdf in enumerate(pdfs):
    name = pdf.stem
    out = THUMB_DIR / f"{name}.png"
    if out.exists():
        ok += 1
        continue
    r = subprocess.run(
        ["pdftoppm", "-f", "1", "-l", "1", "-r", "150", "-png", "-singlefile",
         str(pdf), str(THUMB_DIR / name)],
        capture_output=True
    )
    if r.returncode == 0:
        ok += 1
    else:
        fail += 1
    if (i + 1) % 20 == 0:
        print(f"  [{i+1}/{len(pdfs)}] {ok} ok, {fail} fail")

print(f"  Done: {ok} extracted, {fail} failed\n")

# Phase 2: Upload to R2
print(f"Phase 2: Uploading to R2...")
thumbs = sorted(THUMB_DIR.glob("*.png"))
ok = fail = 0
for i, thumb in enumerate(thumbs):
    r = subprocess.run(
        ["wrangler", "r2", "object", "put",
         f"unredacted-pdfs/thumbnails/{thumb.name}",
         "--file", str(thumb)],
        capture_output=True,
        env={**os.environ, "CLOUDFLARE_API_TOKEN": TOKEN}
    )
    if r.returncode == 0:
        ok += 1
    else:
        fail += 1
    if (i + 1) % 20 == 0:
        print(f"  [{i+1}/{len(thumbs)}] {ok} uploaded, {fail} failed")

print(f"  Done: {ok} uploaded, {fail} failed")
