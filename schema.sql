-- Unredacted D1 Schema
-- SQLite on Cloudflare's edge with FTS5 full-text search

-- ── Documents ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,              -- filename stem
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  release_date TEXT,
  incident_date TEXT,
  incident_location TEXT,
  doc_type TEXT DEFAULT 'PDF',
  description TEXT DEFAULT '',
  filename TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  thumbnail_url TEXT,
  total_pages INTEGER DEFAULT 0,
  ocr_pages INTEGER DEFAULT 0,
  legibility_avg TEXT DEFAULT 'unknown',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_agency ON documents(agency);
CREATE INDEX IF NOT EXISTS idx_docs_date ON documents(release_date);

-- ── Pages (OCR text per page) ─────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL REFERENCES documents(id),
  page_number INTEGER NOT NULL,
  page_type TEXT DEFAULT 'unknown',
  content TEXT NOT NULL,            -- full OCR text
  legibility TEXT DEFAULT 'unknown',
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_doc ON pages(document_id);

-- ── Page metadata (extracted fields) ──────────────────────
CREATE TABLE IF NOT EXISTS page_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id),
  field_name TEXT NOT NULL,         -- 'case_numbers', 'dates', etc.
  field_value TEXT NOT NULL,
  UNIQUE(page_id, field_name, field_value)
);

CREATE INDEX IF NOT EXISTS idx_fields_name ON page_fields(field_name);
CREATE INDEX IF NOT EXISTS idx_fields_value ON page_fields(field_value);

-- ── Full-text search (FTS5) ───────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS search_idx USING fts5(
  document_id,
  page_number,
  content,
  agency,
  title,
  metadata,                         -- concatenated field values
  content=pages,
  content_rowid=id,
  tokenize='porter unicode61'
);

-- ── Triggers to keep FTS in sync ──────────────────────────
CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO search_idx(document_id, page_number, content, agency, title, metadata)
  SELECT
    NEW.document_id,
    NEW.page_number,
    NEW.content,
    COALESCE((SELECT agency FROM documents WHERE id = NEW.document_id), ''),
    COALESCE((SELECT title FROM documents WHERE id = NEW.document_id), ''),
    (
      SELECT GROUP_CONCAT(field_value, ' ')
      FROM page_fields
      WHERE page_id = NEW.id
    );
END;

CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO search_idx(search_idx, document_id, page_number, content, agency, title, metadata)
  VALUES('delete', OLD.document_id, OLD.page_number, OLD.content, '', '', '');
END;

-- ── Stamps and markings per page ──────────────────────────
CREATE TABLE IF NOT EXISTS page_stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id),
  stamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stamps_page ON page_stamps(page_id);
