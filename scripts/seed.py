#!/usr/bin/env python3
"""
Seed D1 database from OCR results + manifest.
Run AFTER the OCR pipeline completes and wrangler login is done.

Usage: python3 scripts/seed.py | wrangler d1 execute unredacted-db --file=-
"""

import json, sys
from pathlib import Path

OCR_DIR = Path("/mnt/downloads-cache/war-ufo/ocr")
MANIFEST = Path("/mnt/downloads-cache/war-ufo/manifest.json")

def esc(s):
    """SQL-escape a string."""
    if s is None:
        return ''
    if not isinstance(s, str):
        s = str(s)
    return s.replace("'", "''")

def main():
    print("-- Unredacted D1 Seed Script")
    print("-- Generated automatically from OCR pipeline output\n")

    # ── Insert documents from manifest ─────────────────────
    with open(MANIFEST) as f:
        manifest = json.load(f)

    pdf_urls = manifest.get("pdf_files", [])
    seen = set()
    doc_count = 0

    for url in pdf_urls:
        fname = url.split("/")[-1]
        if fname in seen:
            continue
        seen.add(fname)

        doc_id = Path(fname).stem
        title = esc(doc_id.replace("_", " ").replace("-", " "))
        agency = ("FBI" if "fbi" in url.lower() or "hq-83894" in url.lower()
                  else "NASA" if "nasa" in url.lower()
                  else "DoD" if "dow" in url.lower() or "uap-d" in url.lower()
                  else "DOS" if "dos" in url.lower()
                  else "Unknown")

        doc_ocr_dir = OCR_DIR / doc_id
        ocr_pages = len(list(doc_ocr_dir.glob("page_*.json"))) if doc_ocr_dir.exists() else 0

        # Count PDF pages
        pdf_path = Path("/mnt/downloads-cache/war-ufo/pdfs") / fname
        total_pages = 1
        if pdf_path.exists():
            import subprocess
            result = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True)
            for line in result.stdout.split("\n"):
                if line.startswith("Pages:"):
                    total_pages = int(line.split(":")[1].strip())

        thumb = url.replace(".pdf", ".jpg").replace("medialink/ufo", "medialink/ufo/thumbnail")

        print(f"INSERT OR IGNORE INTO documents (id, title, agency, doc_type, filename, pdf_url, thumbnail_url, total_pages, ocr_pages)")
        print(f"VALUES ('{esc(doc_id)}', '{title}', '{agency}', 'PDF', '{esc(fname)}', '{esc(url)}', '{esc(thumb)}', {total_pages}, {ocr_pages});")
        doc_count += 1

    print(f"\n-- Inserted {doc_count} documents\n")

    # ── Insert pages from OCR ──────────────────────────────
    page_count = 0
    field_count = 0
    stamp_count = 0

    for doc_dir in sorted(OCR_DIR.iterdir()):
        if not doc_dir.is_dir():
            continue
        doc_id = doc_dir.name
        for pf in sorted(doc_dir.glob("page_*.json")):
            try:
                data = json.loads(pf.read_text())
            except:
                continue

            page_num = int(pf.stem.split("_")[1])
            content = esc(data.get("content", ""))
            page_type = data.get("page_type", "unknown")
            legibility = data.get("legibility", "unknown")
            meta = data.get("_meta", {})
            pt = meta.get("prompt_tokens", 0)
            ct = meta.get("completion_tokens", 0)

            # Insert page
            print(f"INSERT OR IGNORE INTO pages (document_id, page_number, page_type, content, legibility, prompt_tokens, completion_tokens)")
            print(f"VALUES ('{esc(doc_id)}', {page_num}, '{esc(page_type)}', '{content}', '{esc(legibility)}', {pt}, {ct});")
            page_count += 1

            # Insert page fields — reference page by (document_id, page_number)
            fields = data.get("fields", {})
            for fname, values in fields.items():
                if isinstance(values, list):
                    for v in values:
                        if v and str(v).strip():
                            print(f"INSERT OR IGNORE INTO page_fields (page_id, field_name, field_value)")
                            print(f"SELECT id, '{esc(fname)}', '{esc(str(v))}' FROM pages WHERE document_id = '{esc(doc_id)}' AND page_number = {page_num};")
                            field_count += 1

            # Insert stamps
            stamps = data.get("stamps_and_markings", [])
            if isinstance(stamps, list):
                for s in stamps:
                    if not s:
                        continue
                    if not isinstance(s, str):
                        s = s.get('text', str(s)) if isinstance(s, dict) else str(s)
                    if s.strip():
                        print(f"INSERT OR IGNORE INTO page_stamps (page_id, stamp)")
                        print(f"SELECT id, '{esc(s)}' FROM pages WHERE document_id = '{esc(doc_id)}' AND page_number = {page_num};")
                        stamp_count += 1

    print(f"\n-- Inserted {page_count} pages, {field_count} fields, {stamp_count} stamps")
    print(f"-- Run: wrangler d1 execute unredacted-db --file=seed.sql")


if __name__ == "__main__":
    main()
