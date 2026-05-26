import type { InvoiceExtraction, SavedInvoice } from '../types/invoice'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    if (payload.detail) {
      return payload.detail
    }
  } catch {
    // ignore parse errors
  }
  return fallback
}

export function getInvoicePdfUrl(invoiceId: number): string {
  return `${API_BASE}/invoices/${invoiceId}/image`
}

export async function listInvoices(): Promise<SavedInvoice[]> {
  const response = await fetch(`${API_BASE}/invoices`)
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load invoices'))
  }
  return response.json() as Promise<SavedInvoice[]>
}

export async function getInvoice(invoiceId: number): Promise<SavedInvoice> {
  const response = await fetch(`${API_BASE}/invoices/${invoiceId}`)
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load invoice'))
  }
  return response.json() as Promise<SavedInvoice>
}

export async function extractInvoice(pdf: Blob, filename: string): Promise<SavedInvoice> {
  const formData = new FormData()
  const uploadFile =
    pdf instanceof File
      ? pdf
      : new File([pdf], filename, { type: pdf.type || 'application/pdf' })
  formData.append('file', uploadFile, uploadFile.name)

  const response = await fetch(`${API_BASE}/invoices/extract`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to process invoice'))
  }

  return response.json() as Promise<SavedInvoice>
}

export async function updateInvoice(
  invoiceId: number,
  payload: InvoiceExtraction,
): Promise<SavedInvoice> {
  const response = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to update invoice'))
  }

  return response.json() as Promise<SavedInvoice>
}

export async function deleteInvoice(invoiceId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/invoices/${invoiceId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to delete invoice'))
  }
}

export async function askAboutInvoices(
  message: string,
  sessionId?: string | null,
): Promise<{ reply: string; session_id: string }> {
  const response = await fetch(`${API_BASE}/invoices/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to get a reply'))
  }

  return response.json() as Promise<{ reply: string; session_id: string }>
}
