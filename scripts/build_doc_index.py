#!/usr/bin/env python3
"""
Build the document index JSON from manifest.json + OCR results.
Run after the OCR pipeline completes, or now for a metadata-only index.
"""

import json, sys
from pathlib import Path

MANIFEST = Path("/mnt/downloads-cache/war-ufo/manifest.json")
OCR_DIR = Path("/mnt/downloads-cache/war-ufo/ocr")
OUTPUT = Path("/tmp/war-site/public/data/documents.json")

def main():
    with open(MANIFEST) as f:
        manifest = json.load(f)

    pdf_files = manifest.get("pdf_files", [])
    image_files = manifest.get("image_files", [])

    docs = []
    seen = set()

    # Process PDF entries
    for url in pdf_files:
        fname = url.split("/")[-1]
        if fname in seen:
            continue
        seen.add(fname)

        doc_id = Path(fname).stem
        doc_ocr_dir = OCR_DIR / doc_id

        # Count pages
        pages = 0
        pdf_path = Path("/mnt/downloads-cache/war-ufo/pdfs") / fname
        if pdf_path.exists():
            import subprocess
            result = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True)
            for line in result.stdout.split("\n"):
                if line.startswith("Pages:"):
                    pages = int(line.split(":")[1].strip())

        # Count OCR pages
        ocr_pages = 0
        if doc_ocr_dir.exists():
            ocr_pages = len(list(doc_ocr_dir.glob("page_*.json")))

        # Aggregate OCR metadata
        case_numbers = set()
        dates = set()
        foipa_refs = set()
        serial_numbers = set()
        legibility_scores = []

        if doc_ocr_dir.exists():
            for page_file in sorted(doc_ocr_dir.glob("page_*.json")):
                try:
                    page = json.loads(page_file.read_text())
                    fields = page.get("fields", {})
                    for cn in fields.get("case_numbers", []):
                        case_numbers.add(cn)
                    for d in fields.get("dates", []):
                        dates.add(d)
                    for f in fields.get("foipa_references", []):
                        foipa_refs.add(f)
                    for s in fields.get("serial_numbers", []):
                        serial_numbers.add(s)
                    if page.get("legibility"):
                        legibility_scores.append(page["legibility"])
                except:
                    pass

        # Determine most common legibility
        from collections import Counter
        leg_avg = Counter(legibility_scores).most_common(1)
        leg_avg = leg_avg[0][0] if leg_avg else "unknown"

        # Build document entry
        docs.append({
            "id": doc_id,
            "title": doc_id.replace("_", " ").replace("-", " "),
            "agency": "FBI" if "fbi" in url.lower() or "hq-83894" in url.lower()
                      else "NASA" if "nasa" in url.lower()
                      else "DoD" if "dow" in url.lower() or "uap-d" in url.lower()
                      else "DOS" if "dos" in url.lower()
                      else "Unknown",
            "release_date": "2026-05-08",
            "incident_date": "N/A",
            "incident_location": "N/A",
            "type": "PDF",
            "description": "",
            "filename": fname,
            "pdf_url": url,
            "thumbnail_url": url.replace(".pdf", ".jpg").replace("medialink/ufo", "medialink/ufo/thumbnail"),
            "pages": pages,
            "ocr_pages": ocr_pages,
            "case_numbers": sorted(case_numbers),
            "dates": sorted(dates),
            "foipa_references": sorted(foipa_refs),
            "serial_numbers": sorted(serial_numbers),
            "legibility_avg": leg_avg,
        })

    # Add image entries
    for rec in image_files:
        url = rec.get("url", "")
        fname = url.split("/")[-1]
        doc_id = Path(fname).stem
        if doc_id in seen:
            continue
        seen.add(doc_id)

        docs.append({
            "id": doc_id,
            "title": doc_id.replace("_", " ").replace("-", " "),
            "agency": "FBI" if "fbi" in url.lower() else "NASA" if "nasa" in url.lower() else "Unknown",
            "release_date": "2026-05-08",
            "incident_date": "N/A",
            "incident_location": "N/A",
            "type": "IMAGE",
            "description": "",
            "filename": fname,
            "pdf_url": url,
            "thumbnail_url": url,
            "pages": 1,
            "ocr_pages": 0,
            "case_numbers": [],
            "dates": [],
            "foipa_references": [],
            "serial_numbers": [],
            "legibility_avg": "unknown",
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(docs, f, indent=2)

    # Stats
    agencies = {}
    for d in docs:
        a = d["agency"]
        agencies[a] = agencies.get(a, 0) + 1
    total_pages = sum(d["pages"] for d in docs)
    total_ocr = sum(d["ocr_pages"] for d in docs)

    print(f"Built index: {len(docs)} documents")
    print(f"  Total pages: {total_pages:,}")
    print(f"  OCR pages: {total_ocr:,}")
    print(f"  Agencies: {json.dumps(agencies)}")
    print(f"  Output: {OUTPUT}")


if __name__ == "__main__":
    main()
