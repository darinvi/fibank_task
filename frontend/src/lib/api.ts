import type { InvoiceExtraction, SavedExpenseReportPdf, SavedInvoice } from '../types/invoice'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
/** Client-side cap for slow LLM-backed routes (extract, ask). */
const API_TIMEOUT_MS = 3 * 60 * 1000

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS)
  const signal =
    init?.signal != null
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal

  return fetch(input, { ...init, signal })
}

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

export function getExpenseReportPdfUrl(pdfId: number): string {
  return `${API_BASE}/expense-reports/${pdfId}`
}

export async function generateExpenseReportPdf(invoiceId: number): Promise<SavedExpenseReportPdf> {
  const response = await apiFetch(`${API_BASE}/invoices/${invoiceId}/expense-report`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to generate expense report PDF'))
  }

  return response.json() as Promise<SavedExpenseReportPdf>
}

export async function listExpenseReports(): Promise<SavedExpenseReportPdf[]> {
  const response = await fetch(`${API_BASE}/expense-reports`)
  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to load generated PDFs'))
  }

  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('Failed to load generated PDFs (API route not reachable)')
  }

  return response.json() as Promise<SavedExpenseReportPdf[]>
}

export async function downloadExpenseReportPdf(pdfId: number, filename: string): Promise<void> {
  const response = await fetch(getExpenseReportPdfUrl(pdfId))

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to download PDF'))
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function deleteExpenseReport(pdfId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/expense-reports/${pdfId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await readError(response, 'Failed to delete PDF'))
  }
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

  const response = await apiFetch(`${API_BASE}/invoices/extract`, {
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
  const response = await apiFetch(`${API_BASE}/invoices/ask`, {
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
