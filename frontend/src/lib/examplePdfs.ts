const SAMPLES_BASE = '/samples'
const SAMPLES_INDEX_URL = `${SAMPLES_BASE}/index.json`

export function getExamplePdfUrl(filename: string): string {
  return `${SAMPLES_BASE}/${encodeURIComponent(filename)}`
}

export async function loadExamplePdfFilenames(): Promise<string[]> {
  const response = await fetch(SAMPLES_INDEX_URL)
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
