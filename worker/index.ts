// Unredacted API Worker
// Runs on Cloudflare Workers, queries D1, serves search results

interface Env {
  DB: D1Database;
  PDFS: R2Bucket;
  CORS_ORIGIN: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: cors(env.CORS_ORIGIN),
      });
    }

    try {
      // ── Search ──────────────────────────────────────────
      if (path === '/api/search' && req.method === 'GET') {
        return await handleSearch(url, env);
      }

      // ── PDF downloads ───────────────────────────────────
      if (path.startsWith('/api/pdfs/') && req.method === 'GET') {
        const name = path.split('/api/pdfs/')[1];
        return await handlePDF(name, env);
      }

      // ── Thumbnails ──────────────────────────────────────
      if (path.startsWith('/api/thumbnails/') && req.method === 'GET') {
        const name = path.split('/api/thumbnails/')[1];
        return await handleThumbnail(name, env);
      }

      // ── Document list ───────────────────────────────────
      if (path === '/api/documents' && req.method === 'GET') {
        return await handleDocumentList(url, env);
      }

      // ── Document detail ─────────────────────────────────
      const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
      if (docMatch && req.method === 'GET') {
        return await handleDocument(docMatch[1], env);
      }

      // ── Document pages ──────────────────────────────────
      const pagesMatch = path.match(/^\/api\/documents\/([^/]+)\/pages$/);
      if (pagesMatch && req.method === 'GET') {
        return await handlePages(pagesMatch[1], env);
      }

      // ── Single page ─────────────────────────────────────
      const pageMatch = path.match(/^\/api\/documents\/([^/]+)\/pages\/(\d+)$/);
      if (pageMatch && req.method === 'GET') {
        return await handlePage(pageMatch[1], parseInt(pageMatch[2]), env);
      }

      // ── Agencies list ───────────────────────────────────
      if (path === '/api/agencies' && req.method === 'GET') {
        return await handleAgencies(env);
      }

      // ── Stats ───────────────────────────────────────────
      if (path === '/api/stats' && req.method === 'GET') {
        return await handleStats(env);
      }

      return json({ error: 'Not found' }, 404, env.CORS_ORIGIN);
    } catch (e: any) {
      return json({ error: e.message }, 500, env.CORS_ORIGIN);
    }
  },
};

// ── Handlers ──────────────────────────────────────────────────

async function handleSearch(url: URL, env: Env): Promise<Response> {
  const q = url.searchParams.get('q') || '';
  const agency = url.searchParams.get('agency') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '25')));
  const offset = (page - 1) * limit;

  // Empty query → list all
  if (!q || q.trim().length < 2) {
    return await handleDocumentList(url, env);
  }

  // Build FTS5 query with prefix matching
  const terms = q.trim().replace(/['"]/g, '').split(/\s+/).filter(Boolean);
  const ftsQuery = terms.map(t => `"${t}"*`).join(' AND ');

  // Search page content + document titles
  let sql: string;
  let params: any[];

  if (agency) {
    sql = `
      SELECT
        s.document_id,
        s.page_number,
        d.title,
        d.agency,
        d.release_date,
        d.description,
        d.pdf_url,
        d.total_pages,
        snippet(search_idx, 2, '<mark>', '</mark>', '…', 40) AS snippet,
        rank
      FROM search_idx s
      JOIN documents d ON d.id = s.document_id
      WHERE search_idx MATCH ?1
        AND d.agency = ?2
      ORDER BY rank
      LIMIT ?3 OFFSET ?4
    `;
    params = [ftsQuery, agency, limit, offset];
  } else {
    sql = `
      SELECT
        s.document_id,
        s.page_number,
        d.title,
        d.agency,
        d.release_date,
        d.description,
        d.pdf_url,
        d.total_pages,
        snippet(search_idx, 2, '<mark>', '</mark>', '…', 40) AS snippet,
        rank
      FROM search_idx s
      JOIN documents d ON d.id = s.document_id
      WHERE search_idx MATCH ?1
      ORDER BY rank
      LIMIT ?2 OFFSET ?3
    `;
    params = [ftsQuery, limit, offset];
  }

  const { results } = await env.DB.prepare(sql).bind(...params).all();

  // Also search document titles for matches (non-FTS fallback)
  const titleSql = agency
    ? `SELECT id AS document_id, NULL AS page_number, title, agency, release_date, description, pdf_url, total_pages, title AS snippet, 0 AS rank
       FROM documents WHERE title LIKE ?1 AND agency = ?2
       ORDER BY title LIMIT 5`
    : `SELECT id AS document_id, NULL AS page_number, title, agency, release_date, description, pdf_url, total_pages, title AS snippet, 0 AS rank
       FROM documents WHERE title LIKE ?1
       ORDER BY title LIMIT 5`;

  const titleParams = agency ? [`%${q}%`, agency] : [`%${q}%`];
  const { results: titleResults } = await env.DB.prepare(titleSql).bind(...titleParams).all();

  // Merge: FTS content results first, then title matches, dedup by document_id
  const seen = new Set<string>();
  const merged = [];
  for (const r of [...(results as any[]), ...(titleResults as any[])]) {
    if (!seen.has(r.document_id)) {
      seen.add(r.document_id);
      merged.push(r);
    }
  }

  // Count total unique document hits
  const countSql = agency
    ? `SELECT COUNT(DISTINCT s.document_id) as total FROM search_idx s JOIN documents d ON d.id = s.document_id WHERE search_idx MATCH ?1 AND d.agency = ?2`
    : `SELECT COUNT(DISTINCT s.document_id) as total FROM search_idx s WHERE search_idx MATCH ?1`;

  const countParams = agency ? [ftsQuery, agency] : [ftsQuery];
  const { results: countResults } = await env.DB.prepare(countSql).bind(...countParams).all();
  const total = (countResults[0] as any)?.total || 0;

  return json({
    results: merged,
    total,
    page,
    pages: Math.ceil(total / limit),
    query: q,
  }, 200, env.CORS_ORIGIN);
}

async function handleDocumentList(url: URL, env: Env): Promise<Response> {
  const agency = url.searchParams.get('agency') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100')));

  let sql: string;
  let params: any[];
  if (agency) {
    sql = 'SELECT * FROM documents WHERE agency = ?1 ORDER BY title LIMIT ?2 OFFSET ?3';
    params = [agency, limit, (page - 1) * limit];
  } else {
    sql = 'SELECT * FROM documents ORDER BY title LIMIT ?1 OFFSET ?2';
    params = [limit, (page - 1) * limit];
  }

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({
    results: (results as any[]).map(r => ({
      document_id: r.id,
      ...r,
    })),
    total: results.length,
    page,
  }, 200, env.CORS_ORIGIN);
}

async function handleDocument(id: string, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM documents WHERE id = ?1'
  ).bind(id).all();

  if (results.length === 0) {
    return json({ error: 'Document not found' }, 404, env.CORS_ORIGIN);
  }

  return json(results[0], 200, env.CORS_ORIGIN);
}

async function handlePages(docId: string, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT page_number, page_type, legibility FROM pages WHERE document_id = ?1 ORDER BY page_number'
  ).bind(docId).all();

  return json(results, 200, env.CORS_ORIGIN);
}

async function handlePage(docId: string, pageNum: number, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT p.*,
      (SELECT GROUP_CONCAT(field_value, ', ') FROM page_fields WHERE page_id = p.id AND field_name = 'case_numbers') AS case_numbers,
      (SELECT GROUP_CONCAT(field_value, ', ') FROM page_fields WHERE page_id = p.id AND field_name = 'dates') AS dates,
      (SELECT GROUP_CONCAT(field_value, ', ') FROM page_fields WHERE page_id = p.id AND field_name = 'agencies') AS agencies,
      (SELECT GROUP_CONCAT(stamp, ', ') FROM page_stamps WHERE page_id = p.id) AS stamps
     FROM pages p WHERE p.document_id = ?1 AND p.page_number = ?2`
  ).bind(docId, pageNum).all();

  if (results.length === 0) {
    return json({ error: 'Page not found' }, 404, env.CORS_ORIGIN);
  }

  return json(results[0], 200, env.CORS_ORIGIN);
}

async function handleAgencies(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT agency, COUNT(*) as count FROM documents GROUP BY agency ORDER BY count DESC'
  ).all();

  return json(results, 200, env.CORS_ORIGIN);
}

async function handlePDF(name: string, env: Env): Promise<Response> {
  try {
    const obj = await env.PDFS.get(name);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'public, max-age=86400',
        ...cors(env.CORS_ORIGIN),
      },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
}

async function handleThumbnail(name: string, env: Env): Promise<Response> {
  try {
    const obj = await env.PDFS.get(`thumbnails/${name}`);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        ...cors(env.CORS_ORIGIN),
      },
    });
  } catch {
    return new Response('Error', { status: 500 });
  }
}

async function handleStats(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM documents) as total_docs,
      (SELECT COUNT(*) FROM pages) as total_pages,
      (SELECT COUNT(DISTINCT agency) FROM documents) as total_agencies
  `).all();

  return json(results[0], 200, env.CORS_ORIGIN);
}

// ── Helpers ───────────────────────────────────────────────────

function json(data: any, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors(origin),
    },
  });
}

function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
