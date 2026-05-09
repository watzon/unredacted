import { Link } from 'react-router-dom'
import type { DocumentMeta } from '../lib/types'
import { agencyColor, formatDate } from '../lib/types'

export function DocumentCard({ doc }: { doc: DocumentMeta }) {
  return (
    <Link
      to={`/document/${doc.id}`}
      className="group block bg-war-surface border border-war-border rounded-lg p-5
                 hover:border-war-accent/50 hover:bg-war-surface/80 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`${agencyColor(doc.agency)} text-white text-xs px-2 py-0.5 rounded font-medium`}>
          {doc.agency}
        </span>
        <span className="text-war-muted text-xs">{formatDate(doc.release_date)}</span>
      </div>

      <h3 className="font-medium text-sm mb-2 line-clamp-2 group-hover:text-war-accent transition-colors">
        {doc.title}
      </h3>

      <p className="text-war-muted text-xs line-clamp-3 mb-3">
        {doc.description || 'No description available.'}
      </p>

      <div className="flex items-center gap-3 text-war-muted text-xs">
        <span>{doc.pages || '?'} pages</span>
        {doc.case_numbers.length > 0 && (
          <span className="font-mono text-[10px] bg-war-bg px-2 py-0.5 rounded">
            {doc.case_numbers[0]}
          </span>
        )}
        <span className="ml-auto">{doc.ocr_pages ? 'OCR ✓' : ''}</span>
      </div>
    </Link>
  )
}
