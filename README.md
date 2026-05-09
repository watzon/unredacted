# UNREDACTED

**Declassified UAP documents from the Department of War PURSUE program.**

A searchable, full-text archive of 116 declassified government documents related to Unidentified Anomalous Phenomena — FBI case files, NASA crew debriefings, DoD mission reports, and State Department cables. All 4,153 pages OCR'd and indexed for research.

**[unredacted.space](https://unredacted.space)**

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Cloudflare Pages (React + Vite)        │  Static frontend
│  unredacted.space                       │
├─────────────────────────────────────────┤
│  Cloudflare Worker (TypeScript)         │  Search API, thumbnails, PDF proxy
│  api.unredacted.space                   │
├─────────────────────────────────────────┤
│  Cloudflare D1 (SQLite + FTS5)          │  Document index, full-text search
├─────────────────────────────────────────┤
│  Cloudflare R2 (Object Storage)         │  116 PDFs, thumbnails
└─────────────────────────────────────────┘
```

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Search:** D1 FTS5 ranked full-text with snippet highlighting
- **PDFs:** Served from R2 via Worker proxy (zero egress fees)
- **OCR:** Gemini 2.5 Flash Lite via OpenRouter (~$3 total for 4,153 pages)
- **Cost:** $0.00/mo (Cloudflare free tier)

## Project Structure

```
├── site/                  # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/         # HomePage, BrowsePage, DocumentPage
│   │   ├── components/    # Layout, CaseFileCard, DocumentCard
│   │   └── lib/           # types, data fetching, utilities
│   └── public/            # favicon, data/
├── worker/                # Cloudflare Worker (search API)
│   └── index.ts           # D1 queries, R2 proxy, thumbnails
├── scripts/               # Data pipeline
│   ├── war_ocr_pipeline.py      # OCR: PDF → image → Gemini → JSON
│   ├── seed.py                  # OCR JSON → D1 SQL import
│   ├── build_doc_index.py       # Builds documents.json for the site
│   ├── generate_thumbs2.py      # Extract + upload page-1 thumbnails
│   └── upload_thumbs_api.py     # R2 upload via REST API
├── schema.sql             # D1 database schema (documents, pages, FTS5)
├── wrangler.toml          # Cloudflare configuration
└── package.json           # Root scripts (deploy, seed, etc.)
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) (or Node.js + npm)
- Python 3.11+ with `requests`, `openai`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`bun add -g wrangler`)
- Cloudflare account with API token (D1, R2, Workers, Pages permissions)
- OpenRouter API key (for OCR)

### Install

```bash
git clone https://github.com/watzon/unredacted.git
cd unredacted

# Frontend
cd site && bun install && cd ..

# Python deps
pip install requests openai

# Auth
export CLOUDFLARE_API_TOKEN="cfut_..."
```

### Development

```bash
bun run dev          # Start Vite dev server (http://localhost:5173)
bun run lint         # ESLint + jsx-a11y accessibility checks
```

### Deploy

```bash
bun run deploy       # Deploy Worker + Pages
bun run seed         # Seed D1 from OCR results
bun run thumbs       # Generate + upload thumbnails
```

## OCR Pipeline

The OCR pipeline processes PDFs through Gemini 2.5 Flash Lite for structured text extraction:

```bash
export OPENROUTER_API_KEY="sk-or-..."
python3 scripts/war_ocr_pipeline.py
```

**Process:**
1. Extract each page as PNG (pdftoppm, 200 DPI)
2. Send to Gemini 2.5 Flash Lite with structured JSON prompt
3. Extract: page_type, full OCR text, case numbers, dates, agencies, FOIPA references, serial numbers, stamps/markings
4. Save per-page JSON to output directory
5. Resume-safe — skips already-processed pages

**Cost:** ~$3.20 total for all 4,153 pages at current Gemini Flash Lite pricing.

**Output structure:**
```
ocr/{document_name}/page_0001.json
ocr/{document_name}/page_0002.json
...
```

## Database Schema

D1 (SQLite on Cloudflare's edge):

- `documents` — metadata per file (agency, dates, type, page count)
- `pages` — per-page OCR text with legibility scores
- `page_fields` — extracted structured data (case numbers, dates, agencies)
- `page_stamps` — rubber stamps and markings
- `search_idx` — FTS5 full-text search index with auto-updating triggers

## License

MIT

---

*some things aren't meant to stay classified*
