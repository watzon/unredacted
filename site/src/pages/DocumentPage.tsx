import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { loadDocument } from '../lib/data'
import type { DocumentMeta, PageOCR } from '../lib/types'
import { agencyColor } from '../lib/types'

export function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<DocumentMeta | null>(null)
  const [pages, setPages] = useState<PageOCR[]>([])
  const [activePage, setActivePage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingPages, setLoadingPages] = useState(false)

  useEffect(() => {
    if (!id) return
    loadDocument(id).then(d => { setDoc(d); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!doc) return
    setLoadingPages(true)
    loadOCRSample(doc.id).then(p => {
      setPages(p)
      setLoadingPages(false)
    })
  }, [doc])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xf-muted font-mono text-sm animate-pulse">OPENING CASE FILE...</p>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="classified-stamp mb-6">FILE NOT FOUND</div>
        <Link to="/" className="text-xf-accent font-mono text-sm hover:underline">← RETURN TO ARCHIVE</Link>
      </div>
    )
  }

  const fileNum = doc.case_numbers[0] || `DOC-${doc.id.slice(0, 8).toUpperCase()}`

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <Link to="/" className="text-xf-muted hover:text-xf-accent text-xs font-mono tracking-wider inline-block mb-6">
        ← CASE FILES
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAIN: Case file viewer */}
        <div className="lg:col-span-2">
          {/* File header — looks like a case file folder tab */}
          <div className="bg-xf-surface border border-xf-border border-b-0 rounded-t-lg px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`${agencyColor(doc.agency)} text-white text-[10px] px-2 py-0.5 rounded-sm font-semibold tracking-wide`}>
                {doc.agency}
              </span>
              <span className="text-xf-muted text-[10px] font-mono tracking-wider">
                {doc.pages} PAGES • {doc.type}
              </span>
            </div>
            <h1 className="text-lg font-mono font-bold tracking-tight uppercase">{doc.title}</h1>
            <p className="text-[10px] font-mono text-xf-muted mt-1 tracking-wider">
              FILE {fileNum} • CASE STATUS: ACTIVE • CLEARANCE: ALPHA-2
            </p>
          </div>

          {/* Document content area */}
          <div className="bg-xf-card border border-xf-border border-t-0 rounded-b-lg">
            {pages.length > 0 ? (
              <>
                {/* Page nav */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-xf-border bg-xf-surface/50">
                  <button
                    onClick={() => setActivePage(Math.max(0, activePage - 1))}
                    disabled={activePage === 0}
                    className="px-3 py-1 text-[10px] font-mono tracking-wider border border-xf-border
                               disabled:opacity-20 hover:border-xf-accent/50 transition-colors"
                  >
                    ◄ PREV
                  </button>
                  <span className="text-[10px] font-mono text-xf-muted tracking-wider">
                    PAGE {activePage + 1} OF {pages.length}
                  </span>
                  <button
                    onClick={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
                    disabled={activePage === pages.length - 1}
                    className="px-3 py-1 text-[10px] font-mono tracking-wider border border-xf-border
                               disabled:opacity-20 hover:border-xf-accent/50 transition-colors"
                  >
                    NEXT ►
                  </button>
                </div>

                {/* Page type & legibility badge */}
                <div className="px-6 py-2 flex items-center gap-4 border-b border-xf-border">
                  <span className="text-[9px] font-mono text-xf-muted tracking-wider">
                    TYPE: {pages[activePage]?.page_type?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  <span className="text-[9px] font-mono tracking-wider" style={{
                    color: pages[activePage]?.legibility === 'good' ? '#4a8f42' :
                           pages[activePage]?.legibility === 'poor' ? '#c0392b' : '#c4a93e'
                  }}>
                    LEGIBILITY: {pages[activePage]?.legibility?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>

                {/* OCR Content — typewriter style */}
                <div className="p-6">
                  <div className="typewriter-text text-sm leading-relaxed">
                    {pages[activePage]?.content || 'No OCR text available for this page.'}
                  </div>

                  {/* Extracted fields for this page */}
                  {pages[activePage]?.fields && Object.entries(pages[activePage].fields)
                    .filter(([, v]) => Array.isArray(v) && v.length > 0).length > 0 && (
                    <div className="mt-4 p-4 bg-xf-bg/50 border border-xf-border rounded-sm">
                      <p className="text-[10px] font-mono text-xf-muted tracking-wider mb-2">
                        EXTRACTED METADATA:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(pages[activePage].fields)
                          .filter(([, v]) => Array.isArray(v) && v.length > 0)
                          .map(([key, values]) => (
                            <div key={key} className="text-xs font-mono">
                              <span className="text-xf-muted">{key.replace(/_/g, ' ').toUpperCase()}: </span>
                              <span className="text-xf-text">{(values as string[]).join(', ')}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Stamps */}
                  {pages[activePage]?.stamps_and_markings?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {pages[activePage].stamps_and_markings.slice(0, 20).map((s, i) => (
                        <span key={i} className="text-[9px] font-mono px-2 py-0.5 bg-xf-red/20
                                                    text-red-300 border border-xf-red/30 rounded-sm tracking-wider">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : loadingPages ? (
              <div className="p-12 text-center">
                <p className="text-xf-muted font-mono text-sm animate-pulse">DECLASSIFYING...</p>
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="classified-stamp mb-4">AWAITING DECLASSIFICATION</div>
                <p className="text-xf-muted font-mono text-xs">OCR pipeline has not processed this file yet.</p>
                <a href={doc.pdf_url} target="_blank" rel="noopener"
                   className="inline-block mt-4 px-6 py-2 bg-xf-accent/20 border border-xf-accent/40
                              text-xf-accent font-mono text-xs tracking-wider hover:bg-xf-accent/30 transition">
                  DOWNLOAD ORIGINAL PDF ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR: Case metadata */}
        <div className="space-y-4">
          {/* Classification stamp */}
          <div className="flex flex-col items-center gap-3 p-4 bg-xf-surface/50 border border-xf-border">
            <span className="declassified-stamp stamp-animate">DECLASSIFIED</span>
            <span className="text-[9px] font-mono text-xf-muted tracking-widest">PER EXECUTIVE ORDER</span>
          </div>

          {/* Case details */}
          <div className="bg-xf-surface border border-xf-border p-4">
            <h3 className="font-mono text-xs font-bold tracking-wider text-xf-accent mb-3 border-b border-xf-border pb-2">
              CASE DETAILS
            </h3>
            <dl className="space-y-2 text-[10px] font-mono">
              <Field label="AGENCY" value={doc.agency} />
              <Field label="RELEASE DATE" value={doc.release_date} />
              <Field label="INCIDENT DATE" value={doc.incident_date} />
              <Field label="LOCATION" value={doc.incident_location} />
              <Field label="TYPE" value={doc.type} />
              <Field label="PAGES" value={String(doc.pages)} />
              <Field label="OCR PAGES" value={`${doc.ocr_pages} INDEXED`} />
            </dl>
          </div>

          {/* Extracted intel */}
          {(doc.case_numbers.length > 0 || doc.serial_numbers.length > 0 ||
            doc.foipa_references.length > 0 || doc.dates.length > 0) && (
            <div className="bg-xf-surface border border-xf-border p-4">
              <h3 className="font-mono text-xs font-bold tracking-wider text-xf-accent mb-3 border-b border-xf-border pb-2">
                EXTRACTED INTEL
              </h3>
              <dl className="space-y-2 text-[10px] font-mono">
                {doc.case_numbers.length > 0 && <Field label="CASE #" value={doc.case_numbers.join(', ')} />}
                {doc.serial_numbers.length > 0 && <Field label="SERIALS" value={doc.serial_numbers.join(', ')} />}
                {doc.foipa_references.length > 0 && <Field label="FOIPA REFS" value={doc.foipa_references.join(', ')} />}
                {doc.dates.length > 0 && <Field label="DATES" value={doc.dates.join(', ')} />}
              </dl>
            </div>
          )}

          {/* Evidence attachments */}
          <div className="bg-xf-surface border border-xf-border p-4">
            <h3 className="font-mono text-xs font-bold tracking-wider text-xf-accent mb-3 border-b border-xf-border pb-2">
              EVIDENCE
            </h3>
            <a href={`${API}/api/pdfs/${doc.filename}`} target="_blank" rel="noopener"
               className="block w-full mb-3 px-4 py-3 bg-xf-bg border border-xf-accent/30
                          text-center font-mono text-xs tracking-wider text-xf-accent
                          hover:bg-xf-accent/10 transition group">
              <span className="group-hover:underline">DOWNLOAD PDF</span>
              <span className="block text-[9px] text-xf-muted mt-1">
                {doc.filename}
              </span>
            </a>
            <div className="bg-xf-bg/50 border border-xf-border p-4 text-center">
              <img
                src={`${API}/api/thumbnails/${doc.id}.png`}
                alt={`Preview of ${doc.title}`}
                className="w-full opacity-80 hover:opacity-100 transition border border-xf-border mb-2"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <p className="text-[10px] font-mono text-xf-muted">
                {doc.pages} PAGE{doc.pages !== 1 ? 'S' : ''} • {doc.ocr_pages > 0 ? `${doc.ocr_pages} OCR INDEXED` : 'AWAITING OCR'}
              </p>
            </div>
          </div>

          {/* Back to files */}
          <Link to="/"
                className="block text-center px-4 py-3 border border-xf-border font-mono text-xs
                           text-xf-muted hover:text-xf-accent hover:border-xf-accent/40 transition">
            ← RETURN TO CASE FILES
          </Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value || value === 'N/A' || value === '') return null
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xf-muted shrink-0">{label}</dt>
      <dd className="text-xf-text text-right truncate" title={value}>{value}</dd>
    </div>
  )
}

const API = 'https://unredacted-api.watzon.workers.dev'

async function loadOCRSample(docId: string): Promise<PageOCR[]> {
  try {
    const resp = await fetch(`${API}/api/documents/${docId}/pages`)
    if (resp.ok) {
      const pageList = await resp.json()
      const pages: PageOCR[] = []
      for (const p of pageList.slice(0, 5)) {
        const pr = await fetch(`${API}/api/documents/${docId}/pages/${p.page_number}`)
        if (pr.ok) {
          const data = await pr.json()
          pages.push({
            page_type: data.page_type || 'unknown',
            content: data.content || '',
            legibility: data.legibility || 'unknown',
            fields: {
              case_numbers: (data.case_numbers || '').split(', ').filter(Boolean),
              dates: (data.dates || '').split(', ').filter(Boolean),
              agencies: (data.agencies || '').split(', ').filter(Boolean),
              names: [], classifications: [],
              foipa_references: [], serial_numbers: [], file_references: [], locations: [],
            },
            stamps_and_markings: (data.stamps || '').split(', ').filter(Boolean),
            _meta: { document: docId, page: p.page_number, prompt_tokens: 0, completion_tokens: 0 }
          })
        }
      }
      if (pages.length > 0) return pages
    }
  } catch { /* fallback failed silently */ }
  // Fallback to local
  const pages: PageOCR[] = []
  for (let i = 1; i <= 5; i++) {
    try {
      const resp = await fetch(`/ocr/${docId}/page_${String(i).padStart(4, '0')}.json`)
      if (resp.ok) pages.push(await resp.json())
    } catch { break }
  }
  return pages
}
