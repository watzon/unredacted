// Document metadata types matching the OCR output and CSV manifest

export interface DocumentMeta {
  id: string
  title: string
  agency: string
  release_date: string
  incident_date: string
  incident_location: string
  type: 'PDF' | 'IMAGE' | 'VIDEO'
  description: string
  filename: string
  pdf_url: string
  thumbnail_url: string
  pages: number
  ocr_pages: number
  case_numbers: string[]
  dates: string[]
  foipa_references: string[]
  serial_numbers: string[]
  legibility_avg: string
}

export interface PageOCR {
  page_type: string
  content: string
  fields: {
    case_numbers: string[]
    dates: string[]
    agencies: string[]
    names: string[]
    classifications: string[]
    foipa_references: string[]
    serial_numbers: string[]
    file_references: string[]
    locations: string[]
  }
  stamps_and_markings: string[]
  legibility: string
  _meta: {
    document: string
    page: number
    prompt_tokens: number
    completion_tokens: number
  }
}

export const AGENCY_COLORS: Record<string, string> = {
  FBI: 'bg-[#dc3545]',
  NASA: 'bg-[#1a73e8]',
  DOW: 'bg-[#5d9948]',
  DoD: 'bg-[#5d9948]',
  DOS: 'bg-[#0d9ec4]',
  'Department of State': 'bg-[#0d9ec4]',
  'Department of Justice': 'bg-[#dc3545]',
  Unknown: 'bg-[#6b7280]',
}

export function agencyColor(agency: string): string {
  for (const [key, color] of Object.entries(AGENCY_COLORS)) {
    if (agency.toUpperCase().includes(key.toUpperCase())) return color
  }
  return 'bg-gray-600'
}

export function formatDate(d: string): string {
  if (!d || d === 'N/A') return 'Unknown'
  // Handle various date formats from the CSV
  const cleaned = d.replace(/[\[\]]/g, '').trim()
  const parsed = new Date(cleaned)
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return cleaned
}
