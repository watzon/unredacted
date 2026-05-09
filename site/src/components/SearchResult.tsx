import { Link } from 'react-router-dom'
import { agencyColor } from '../lib/types'

interface SearchHit {
  document_id: string
  page_number: number | null
  title: string
  agency: string
  release_date: string | null
  description: string | null
  pdf_url: string | null
  total_pages: number | null
  snippet: string | null
  rank: number
}

export function SearchResult({ hit, query }: { hit: SearchHit; query: string }) {
  // Parse snippet — may contain <mark> tags from FTS
  const snippet = hit.snippet || ''
  const hasPage = hit.page_number !== null && hit.page_number !== undefined
  const linkTo = hasPage
    ? `/document/${hit.document_id}?page=${hit.page_number}&hl=${encodeURIComponent(query || '')}`
    : `/document/${hit.document_id}?hl=${encodeURIComponent(query || '')}`

  return (
    <Link
      to={linkTo}
      className="block bg-xf-surface border border-xf-border rounded-lg p-5
                 hover:border-xf-accent/40 hover:bg-xf-surface/80 transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`${agencyColor(hit.agency)} text-white text-[10px] px-2 py-0.5 rounded-sm font-semibold tracking-wide shrink-0`}>
          {hit.agency}
        </span>
        <span className="text-[10px] font-mono text-xf-muted tracking-wider truncate">
          {hit.title}
        </span>
        {hasPage && (
          <span className="text-[10px] font-mono text-xf-accent/60 ml-auto shrink-0">
            p.{hit.page_number}
          </span>
        )}
      </div>

      {/* Snippet with highlighted matches */}
      {snippet && (
        <p
          className="text-sm text-xf-text leading-relaxed mb-2 line-clamp-3"
          dangerouslySetInnerHTML={{
            __html: snippet.replace(/<mark>/g, '<mark class="bg-xf-accent/20 text-xf-accent rounded-sm px-0.5">')
          }}
        />
      )}

      {/* No snippet — show description instead */}
      {!snippet && hit.description && (
        <p className="text-xs text-xf-muted line-clamp-2 mb-2">{hit.description}</p>
      )}

      <div className="flex items-center gap-3 text-[10px] font-mono text-xf-muted">
        {hit.total_pages && <span>{hit.total_pages} pages</span>}
        {hit.release_date && <span>{hit.release_date}</span>}
        <span className="ml-auto text-xf-accent/50 group-hover:text-xf-accent transition-colors">
          View document →
        </span>
      </div>
    </Link>
  )
}
