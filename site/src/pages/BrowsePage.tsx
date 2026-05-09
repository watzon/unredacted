import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadDocuments, getUniqueAgencies } from '../lib/data'
import type { DocumentMeta } from '../lib/types'
import { CaseFileCard } from '../components/CaseFileCard'

export function BrowsePage() {
  const [docs, setDocs] = useState<DocumentMeta[]>([])
  const [agencies, setAgencies] = useState<string[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)

  const filterAgency = searchParams.get('agency') || ''
  const filterQuery = searchParams.get('q') || ''

  useEffect(() => {
    Promise.all([loadDocuments(), getUniqueAgencies()]).then(([d, a]) => {
      setDocs(d)
      setAgencies(a)
      setLoading(false)
    })
  }, [])

  const filtered = docs.filter(d => {
    if (filterAgency && d.agency !== filterAgency) return false
    if (filterQuery) {
      const q = filterQuery.toLowerCase()
      if (!d.title.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) return false
    }
    return true
  })

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value); else params.delete(key)
    setSearchParams(params)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-xf-muted font-mono text-sm animate-pulse">RETRIEVING ARCHIVES...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold tracking-tight mb-1">
          <span className="text-xf-accent">UN</span>REDACTED ARCHIVES
        </h1>
        <p className="text-xf-muted text-xs font-mono tracking-wider">
          {filtered.length} OF {docs.length} FILES
          {(filterAgency || filterQuery) && ' (FILTERED)'}
        </p>
      </div>

      {/* Filters — rubber stamp style */}
      <div className="flex flex-wrap items-center gap-4 mb-8 p-4 bg-xf-surface/50 border border-xf-border">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={filterQuery}
            onChange={e => setFilter('q', e.target.value)}
            placeholder="Search files..."
            className="w-full bg-xf-bg border border-xf-border px-3 py-2 text-xs font-mono
                       text-xf-text placeholder-xf-muted/50
                       focus:outline-none focus:border-xf-accent/50 transition-colors"
          />
        </div>

        {/* Agency stamps */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('agency', '')}
            className={`stamp-animate px-3 py-1.5 text-[10px] font-mono tracking-wider border rounded-sm
              ${!filterAgency
                ? 'border-xf-accent text-xf-accent bg-xf-accent/10'
                : 'border-xf-border text-xf-muted hover:border-xf-accent/40 hover:text-xf-text'}`}
          >
            ALL
          </button>
          {agencies.map(a => (
            <button
              key={a}
              onClick={() => setFilter('agency', filterAgency === a ? '' : a)}
              className={`stamp-animate px-3 py-1.5 text-[10px] font-mono tracking-wider border rounded-sm transition-all
                ${filterAgency === a
                  ? 'border-xf-accent text-xf-accent bg-xf-accent/10 scale-105'
                  : 'border-xf-border text-xf-muted hover:border-xf-accent/40 hover:text-xf-text'}`}
            >
              {a} <span className="opacity-50">[{docs.filter(d => d.agency === a).length}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-xf-muted font-mono text-sm">NO FILES MATCH FILTERS</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(doc => (
            <CaseFileCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
