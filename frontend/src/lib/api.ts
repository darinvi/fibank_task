import type { InvoiceExtraction } from '../types/invoice'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export async function extractInvoice(image: Blob, filename: string): Promise<InvoiceExtraction> {
  const formData = new FormData()
  formData.append('file', image, filename)

  const response = await fetch(`${API_BASE}/invoices/extract`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let detail = 'Failed to process invoice'
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        detail = payload.detail
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(detail)
  }

  return response.json() as Promise<InvoiceExtraction>
}
