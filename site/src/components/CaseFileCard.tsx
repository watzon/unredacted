import { Link } from 'react-router-dom'
import type { DocumentMeta } from '../lib/types'
import { agencyColor } from '../lib/types'

export function CaseFileCard({ doc }: { doc: DocumentMeta }) {
  const fileNum = doc.case_numbers[0] || `DOC-${doc.id.slice(0, 8).toUpperCase()}`

  return (
    <Link
      to={`/document/${doc.id}`}
      className="case-file-card group block p-5 relative overflow-hidden"
    >
      {/* Redacted overlay that fades on hover */}
      <div className="absolute inset-0 bg-xf-stamp-red/5 group-hover:opacity-0 transition-opacity duration-500 pointer-events-none" />

      {/* Case number header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono tracking-wider opacity-70">
          {fileNum}
        </span>
        <span className={`${agencyColor(doc.agency)} text-white text-[9px] px-1.5 py-0.5 rounded-sm font-semibold tracking-wide`}>
          {doc.agency}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-mono text-sm font-bold leading-tight mb-2 group-hover:text-xf-accent transition-colors uppercase tracking-tight">
        {doc.title}
      </h3>

      {/* Description snippet */}
      <p className="text-xs opacity-60 line-clamp-2 mb-4 font-mono leading-relaxed">
        {doc.description || 'Contents classified. Click to review file.'}
      </p>

      {/* Footer metadata */}
      <div className="flex items-center justify-between text-[9px] font-mono opacity-55">
        <span>{doc.pages || '?'} PAGES</span>
        <span>{doc.ocr_pages > 0 ? 'OCR INDEXED' : 'PENDING REVIEW'}</span>
      </div>

      {/* Classified diagonal stripe */}
      <div className="absolute -right-8 -bottom-4 opacity-[0.06] text-6xl font-mono font-bold tracking-[20px] select-none group-hover:opacity-0 transition-opacity duration-500">
        CLASSIFIED
      </div>
    </Link>
  )
}
