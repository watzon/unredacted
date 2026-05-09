import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadDocuments, searchDocuments, getUniqueAgencies } from '../lib/data'
import type { DocumentMeta } from '../lib/types'
import { agencyColor } from '../lib/types'
import { CaseFileCard } from '../components/CaseFileCard'
import { SearchResult } from '../components/SearchResult'

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [docs, setDocs] = useState<DocumentMeta[]>([])
  const [agencies, setAgencies] = useState<string[]>([])
  const [results, setResults] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)

  const query = searchParams.get('q') || ''

  // Load document index
  useEffect(() => {
    Promise.all([loadDocuments(), getUniqueAgencies()]).then(([d, a]) => {
      setDocs(d)
      setAgencies(a)
      setLoading(false)
    })
  }, [])

  // Search when URL query changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null)
      return
    }
    searchDocuments(query).then(setResults)
  }, [query])

  const handleSearch = useCallback((q: string) => {
    const params = new URLSearchParams(searchParams)
    if (q.trim()) {
      params.set('q', q)
    } else {
      params.delete('q')
    }
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const totalPages = docs.reduce((s, d) => s + (d.pages || 0), 0)
  const totalOCR = docs.reduce((s, d) => s + (d.ocr_pages || 0), 0)
  const displayDocs = results ?? docs

  return (
    <div>
      {/* Hero — I Want to Believe */}
      <div className="relative overflow-hidden border-b border-xf-border">
        {/* Starfield background */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20% 30%, rgba(196,169,62,0.5), transparent),
                              radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.4), transparent),
                              radial-gradient(1px 1px at 60% 20%, rgba(196,169,62,0.4), transparent),
                              radial-gradient(1px 1px at 80% 50%, rgba(255,255,255,0.3), transparent),
                              radial-gradient(2px 2px at 50% 40%, rgba(196,169,62,0.6), transparent),
                              radial-gradient(1px 1px at 30% 60%, rgba(255,255,255,0.4), transparent),
                              radial-gradient(1px 1px at 70% 80%, rgba(196,169,62,0.3), transparent)`,
          }}
        />

        <div className="max-w-4xl mx-auto px-4 py-20 text-center relative z-10">
          {/* UFO */}
          <div className="text-5xl mb-6 ufo-glow">🛸</div>

          {/* UNREDACTED poster style */}
          <div className="inline-block mb-8 px-8 py-3 border border-xf-accent/30 bg-xf-surface/60 backdrop-blur">
            <h1 className="text-3xl md:text-4xl font-light tracking-[6px] text-xf-accent/80 uppercase font-mono">
              UNREDACTED
            </h1>
          </div>

          <p className="text-xf-muted text-sm max-w-xl mx-auto mb-2 font-mono">
            Declassified UAP documents from the PURSUE program
          </p>

          {/* Stats line */}
          <div className="flex items-center justify-center gap-6 text-xs font-mono text-xf-muted mb-10">
            <span>{docs.length} CASE FILES</span>
            <span className="text-xf-border">│</span>
            <span>{totalPages.toLocaleString()} PAGES</span>
            <span className="text-xf-border">│</span>
            <span>{totalOCR.toLocaleString()} OCR INDEXED</span>
            <span className="text-xf-border">│</span>
            <span>{agencies.length} AGENCIES</span>
          </div>

          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Query case database..."
              className="w-full bg-xf-bg border border-xf-border rounded px-5 py-4 text-sm text-xf-text placeholder-xf-muted/50 font-mono focus:outline-none focus:border-xf-accent/50 transition-all"
            />
            {query && results && (
              <p className="mt-2 text-xs font-mono text-xf-muted">
                {results.length} {results.length === 1 ? 'FILE' : 'FILES'} FOUND
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Agency badges */}
      <div className="border-b border-xf-border bg-xf-surface/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-mono text-xf-muted tracking-widest mr-2">FILTER BY AGENCY:</span>
          {agencies.map(a => {
            const count = docs.filter(d => d.agency === a).length
            return (
              <Link
                key={a}
                to={`/browse?agency=${encodeURIComponent(a)}`}
                className={`${agencyColor(a)} text-white px-3 py-1.5 text-xs font-semibold tracking-wide
                            hover:opacity-80 transition rounded-sm shadow-sm`}
              >
                {a} [{count}]
              </Link>
            )
          })}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        {loading ? (
          <div className="text-center py-20">
            <p className="text-xf-muted font-mono text-sm animate-pulse">
              ACCESSING DATABASE...
            </p>
          </div>
        ) : results ? (
          /* Search results view */
          <div>
            <p className="text-xf-muted text-xs font-mono tracking-wider mb-6">
              {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'} FOR "{query}"
            </p>
            <div className="space-y-4">
              {results.map((hit: any, i: number) => (
                <SearchResult key={`${hit.document_id}-${i}`} hit={hit} query={query} />
              ))}
            </div>
          </div>
        ) : displayDocs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xf-muted font-mono text-sm">
              NO FILES MATCH YOUR QUERY
            </p>
          </div>
        ) : (
          /* Document grid view */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayDocs.slice(0, 24).map(doc => (
                <CaseFileCard key={doc.id} doc={doc} />
              ))}
            </div>
            {displayDocs.length > 24 && (
              <div className="text-center mt-10">
                <Link
                  to="/browse"
                  className="inline-block px-8 py-3 border border-xf-accent/30 text-xf-accent font-mono text-sm
                             hover:bg-xf-accent/10 transition-all"
                >
                  VIEW ALL {displayDocs.length} FILES →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
