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

export function getInvoiceImageUrl(invoiceId: number): string {
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

export async function extractInvoice(image: Blob, filename: string): Promise<SavedInvoice> {
  const formData = new FormData()
  formData.append('file', image, filename)

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
