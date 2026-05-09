#!/usr/bin/env python3
"""
WAR.GOV UFO Archive — Structured OCR Pipeline
=============================================
Extracts all pages from PDFs, sends to Gemini 2.5 Flash Lite via OpenRouter,
and saves structured JSON with metadata + full OCR text.

Usage:
  source ~/.hermes/.env && python3 war_ocr_pipeline.py

Resume-safe: skips already-processed pages.
Output: /mnt/downloads-cache/war-ufo/ocr/{pdf_name}/page_NNN.json
"""

import os, sys, json, base64, time, subprocess, re
from pathlib import Path
from datetime import datetime, timedelta
from openai import OpenAI

# ── Config ──────────────────────────────────────────────────
PDF_DIR = Path("/mnt/downloads-cache/war-ufo/pdfs")
OUT_DIR = Path("/mnt/downloads-cache/war-ufo/ocr")
DPI = 200  # pixels per inch — 200 is good balance of quality vs token cost
MODEL = "google/gemini-2.5-flash-lite"
MAX_RETRIES = 3
DELAY_BETWEEN_PAGES = 0.5  # seconds — be nice to the API

# ── Setup ───────────────────────────────────────────────────
API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
if not API_KEY:
    print("ERROR: OPENROUTER_API_KEY not set. Run: source ~/.hermes/.env")
    sys.exit(1)

client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=API_KEY)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Prompt ──────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an FBI document OCR system. Transcribe this document page into structured JSON.

Instructions:
- page_type: Classify the page. Use one of: file_cover, typed_report, handwritten_note, form, photograph, image, mixed, or other. If the page is a photo without text, use "photograph". If it's a composite/illustration without text, use "image".
- content: Full OCR transcription with spatial sections like "TOP LEFT:", "MIDDLE:", "BOTTOM RIGHT:", etc. Be exhaustive — capture EVERY piece of text.
- fields.case_numbers: Any case/reference numbers (e.g., "62-HQ-83894")
- fields.dates: Any dates found (e.g., "MAR 1 1978")
- fields.agencies: Organizations mentioned (e.g., "FBI", "Department of Justice")
- fields.names: Personal names mentioned
- fields.classifications: Classification/declassification markings
- fields.foipa_references: FOIA/FOIPA request numbers
- fields.serial_numbers: Document serial numbers
- fields.file_references: References to other files
- fields.locations: Geographic locations mentioned
- stamps_and_markings: All rubber stamps and special markings
- legibility: How readable the page is (excellent/good/fair/poor)

Output ONLY valid JSON, no other text."""

# ── State ───────────────────────────────────────────────────
STATE_FILE = OUT_DIR / "pipeline_state.json"
COST_FILE = OUT_DIR / "pipeline_cost.json"

def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"processed": {}, "total_pages": 0, "total_cost": 0.0, "started": None}

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))

def load_costs():
    if COST_FILE.exists():
        return json.loads(COST_FILE.read_text())
    return {"prompt_tokens": 0, "completion_tokens": 0, "total_cost": 0.0, "pages": 0}

def save_costs(costs):
    COST_FILE.write_text(json.dumps(costs, indent=2))

# ── Core ────────────────────────────────────────────────────
def ocr_page(image_path: Path, doc_name: str, page_num: int) -> dict | None:
    """Send a page image to Gemini and get structured JSON back."""
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                    ]}
                ],
                response_format={"type": "json_object"},
                max_tokens=4096,
                temperature=0,
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            # Add provenance
            data["_meta"] = {
                "document": doc_name,
                "page": page_num,
                "model": response.model,
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            }
            return data

        except json.JSONDecodeError:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"    FAILED: JSON parse error after {MAX_RETRIES} attempts")
            return None
        except Exception as e:
            msg = str(e)[:200]
            if "rate_limit" in msg.lower() or "429" in msg:
                wait = 10 * (attempt + 1)
                print(f"    Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"    FAILED: {msg}")
            return None
    return None


def process_pdf(pdf_path: Path, state: dict, costs: dict) -> dict:
    """Process all pages in a single PDF."""
    doc_name = pdf_path.stem
    doc_out = OUT_DIR / doc_name

    if doc_name in state["processed"]:
        prev = state["processed"][doc_name]
        # Only skip if fully done
        if prev.get("status") == "done":
            return state

    doc_out.mkdir(parents=True, exist_ok=True)

    # Count pages
    result = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True)
    total_pages = 1
    for line in result.stdout.split("\n"):
        if line.startswith("Pages:"):
            total_pages = int(line.split(":")[1].strip())

    # Check what's already done
    existing = set()
    for f in doc_out.glob("page_*.json"):
        try:
            num = int(f.stem.split("_")[1])
            existing.add(num)
        except:
            pass

    pages_to_do = [p for p in range(1, total_pages + 1) if p not in existing]
    if not pages_to_do:
        state["processed"][doc_name] = {"status": "done", "pages": total_pages}
        return state

    print(f"\n  {doc_name}: {len(pages_to_do)}/{total_pages} pages to process")

    # Extract pages we need as PNGs
    tmpdir = Path(f"/tmp/ocr-{doc_name}")
    tmpdir.mkdir(exist_ok=True)

    # Extract in batches to avoid command-line length issues
    batch_size = 50
    for batch_start in range(0, len(pages_to_do), batch_size):
        batch = pages_to_do[batch_start:batch_start + batch_size]
        page_ranges = []
        for p in batch:
            page_ranges.extend(["-f", str(p), "-l", str(p)])

        # Extract all pages in this batch
        # pdftoppm doesn't support multiple ranges easily, so do one at a time
        for p in batch:
            tmp_png = tmpdir / f"page_{p:04d}.png"
            if tmp_png.exists():
                continue
            subprocess.run(
                ["pdftoppm", "-f", str(p), "-l", str(p), "-r", str(DPI),
                 "-png", "-singlefile", str(pdf_path),
                 str(tmpdir / f"page_{p:04d}")],
                capture_output=True, timeout=30
            )

    # Process each page
    for page_num in pages_to_do:
        png_path = tmpdir / f"page_{page_num:04d}.png"
        if not png_path.exists():
            print(f"    Page {page_num}: image extraction failed, skipping")
            continue

        print(f"    Page {page_num}/{total_pages} ...", end=" ", flush=True)

        result = ocr_page(png_path, doc_name, page_num)
        if result is None:
            print("FAILED")
            continue

        # Save result
        out_path = doc_out / f"page_{page_num:04d}.json"
        out_path.write_text(json.dumps(result, indent=2))

        # Track costs
        meta = result.get("_meta", {})
        costs["prompt_tokens"] += meta.get("prompt_tokens", 0)
        costs["completion_tokens"] += meta.get("completion_tokens", 0)
        costs["pages"] += 1
        prompt_cost = (meta.get("prompt_tokens", 0) / 1_000_000) * 0.10
        completion_cost = (meta.get("completion_tokens", 0) / 1_000_000) * 0.40
        costs["total_cost"] += prompt_cost + completion_cost

        # Cleanup page image to save disk
        png_path.unlink()

        print(f"OK ({meta.get('prompt_tokens', '?')}t)")
        time.sleep(DELAY_BETWEEN_PAGES)

    # Cleanup tmpdir
    try:
        tmpdir.rmdir()
    except:
        pass

    state["processed"][doc_name] = {"status": "done", "pages": total_pages, "ocr_pages": len(pages_to_do)}
    save_state(state)
    save_costs(costs)
    return state


# ── Main ────────────────────────────────────────────────────
def main():
    state = load_state()
    costs = load_costs()

    if state["started"] is None:
        state["started"] = datetime.now().isoformat()
        save_state(state)

    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    print(f"{'='*60}")
    print(f"  WAR.GOV UFO OCR PIPELINE")
    print(f"{'='*60}")
    print(f"  PDFs: {len(pdfs)}")
    print(f"  Model: {MODEL}")
    print(f"  Output: {OUT_DIR}")
    print(f"  Resume: {'yes' if state['processed'] else 'fresh start'}")
    if costs["pages"] > 0:
        print(f"  So far: {costs['pages']} pages, ${costs['total_cost']:.4f}")
    print()

    total_pages_all = 0
    for pdf in pdfs:
        result = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True)
        for line in result.stdout.split("\n"):
            if line.startswith("Pages:"):
                total_pages_all += int(line.split(":")[1].strip())

    state["total_pages"] = total_pages_all

    # Count already done
    done = sum(1 for v in state["processed"].values() if v.get("status") == "done")
    remaining = len(pdfs) - done

    print(f"  Total pages: {total_pages_all:,}")
    print(f"  PDFs done: {done}/{len(pdfs)}")
    print(f"  Remaining: {remaining}")
    print(f"  Est. cost remaining: ~${(total_pages_all - costs['pages']) * 0.00077:.2f}")
    print(f"  Est. time: ~{(total_pages_all - costs['pages']) * 5 / 3600:.1f}h")
    print()

    for i, pdf in enumerate(pdfs):
        doc_name = pdf.stem
        status = state["processed"].get(doc_name, {}).get("status", "pending")
        marker = "✓" if status == "done" else f"({i+1}/{len(pdfs)})"
        print(f"[{marker}] {doc_name[:70]}")

        if status == "done":
            continue

        state = process_pdf(pdf, state, costs)
        save_state(state)
        save_costs(costs)

        # Periodic summary
        if costs["pages"] > 0:
            avg_cost = costs["total_cost"] / costs["pages"]
            remaining_pages = total_pages_all - costs["pages"]
            est_remaining = remaining_pages * avg_cost
            print(f"\n  [{datetime.now().strftime('%H:%M:%S')}] {costs['pages']:,} pages, "
                  f"${costs['total_cost']:.4f} spent, ~${est_remaining:.2f} remaining")

    # Final summary
    print(f"\n{'='*60}")
    print(f"  PIPELINE COMPLETE")
    print(f"{'='*60}")
    print(f"  Pages processed: {costs['pages']:,}")
    print(f"  Total cost: ${costs['total_cost']:.4f}")
    print(f"  Prompt tokens: {costs['prompt_tokens']:,}")
    print(f"  Completion tokens: {costs['completion_tokens']:,}")
    print(f"  Output: {OUT_DIR}")
    print(f"\n  Next: build Pagefind index with:")
    print(f"    python3 build_search_index.py")

    save_state(state)
    save_costs(costs)


if __name__ == "__main__":
    main()
