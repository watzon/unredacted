import type { DocumentMeta } from './types'

const API = 'https://unredacted-api.watzon.workers.dev'

let _docs: DocumentMeta[] | null = null
let _agencies: string[] | null = null

export async function loadDocuments(): Promise<DocumentMeta[]> {
  if (_docs) return _docs
  try {
    const resp = await fetch(`${API}/api/documents?limit=200`)
    if (!resp.ok) throw new Error('API not ready')
    const data = await resp.json()
    _docs = (data.results || []).map(mapAPIDoc)
    return _docs || []
  } catch { /* API failed, try local fallback */
    try {
      const resp = await fetch('/data/documents.json')
      _docs = await resp.json()
      return _docs || []
    } catch {
      return []
    }
  }
}

export async function loadDocument(id: string): Promise<DocumentMeta | null> {
  try {
    const resp = await fetch(`${API}/api/documents/${id}`)
    if (resp.ok) return mapAPIDoc(await resp.json())
  } catch {}
  const docs = await loadDocuments()
  return docs.find(d => d.id === id) ?? null
}

export async function searchDocuments(query: string): Promise<DocumentMeta[]> {
  try {
    const resp = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}&limit=50`)
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.results || []).map(mapAPIDoc)
  } catch {
    const docs = await loadDocuments()
    const q = query.toLowerCase()
    return docs.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.agency.toLowerCase().includes(q)
    )
  }
}

export async function getUniqueAgencies(): Promise<string[]> {
  if (_agencies) return _agencies
  try {
    const resp = await fetch(`${API}/api/agencies`)
    if (resp.ok) {
      const data = await resp.json()
      _agencies = data.map((a: any) => a.agency)
      return _agencies || []
    }
  } catch {}
  const docs = await loadDocuments()
  _agencies = [...new Set(docs.map(d => d.agency))].sort()
  return _agencies
}

export function getDateRange(docs: DocumentMeta[]): { min: number; max: number } {
  const years = docs
    .map(d => parseInt(d.release_date?.match(/\d{4}/)?.[0] ?? '0'))
    .filter(y => y > 1900)
  return {
    min: Math.min(...years, 2026),
    max: Math.max(...years, 2026),
  }
}

function mapAPIDoc(d: any): DocumentMeta {
  return {
    id: d.document_id || d.id,
    title: d.title || '',
    agency: d.agency || '',
    release_date: d.release_date || '',
    incident_date: d.incident_date || 'N/A',
    incident_location: d.incident_location || 'N/A',
    type: d.doc_type || 'PDF',
    description: d.description || '',
    filename: d.filename || '',
    pdf_url: d.pdf_url || '',
    thumbnail_url: d.thumbnail_url || '',
    pages: d.total_pages || 0,
    ocr_pages: d.ocr_pages || 0,
    case_numbers: d.case_numbers || [],
    dates: d.dates || [],
    foipa_references: d.foipa_references || [],
    serial_numbers: d.serial_numbers || [],
    legibility_avg: d.legibility_avg || 'unknown',
  }
}
