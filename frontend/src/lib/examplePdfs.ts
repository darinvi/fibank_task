const EXAMPLE_PDFS_BASE = '/example-pdfs'
const EXAMPLE_PDFS_INDEX_URL = `${EXAMPLE_PDFS_BASE}/index.json`

export function getExamplePdfUrl(filename: string): string {
  return `${EXAMPLE_PDFS_BASE}/${encodeURIComponent(filename)}`
}

export async function loadExamplePdfFilenames(): Promise<string[]> {
  const response = await fetch(EXAMPLE_PDFS_INDEX_URL)
  if (!response.ok) {
    return []
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) {
    return []
  }

  return data.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

export async function fetchExamplePdf(filename: string): Promise<File> {
  const response = await fetch(getExamplePdfUrl(filename))
  if (!response.ok) {
    throw new Error(`Could not load ${filename}`)
  }

  const blob = await response.blob()
  return new File([blob], filename, { type: 'application/pdf' })
}
