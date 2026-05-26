import type { SavedInvoice, SavedLineItem } from '../types/invoice'

export const EXPENSE_REPORT_LOGO_PATH = '/expense-report-logo.png'

export const EXPENSE_REPORT_LOGO_MAX_WIDTH_MM = 65
export const EXPENSE_REPORT_LOGO_MAX_HEIGHT_MM = 14
export const EXPENSE_REPORT_LOGO_PREVIEW_HEIGHT_PX = 40

export type PreparedLogo = {
  dataUrl: string
  format: 'PNG' | 'JPEG'
  pixelWidth: number
  pixelHeight: number
}

function detectImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return 'JPEG'
  }
  return 'PNG'
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load logo'))
    image.src = src
  })
}

export function fitLogoBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: maxWidth, height: maxHeight }
  }

  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  }
}

export async function prepareExpenseReportLogo(url: string): Promise<PreparedLogo | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    try {
      const image = await loadImageElement(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight

      const context = canvas.getContext('2d')
      if (!context) {
        return null
      }

      context.drawImage(image, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')

      return {
        dataUrl,
        format: detectImageFormat(dataUrl),
        pixelWidth: image.naturalWidth,
        pixelHeight: image.naturalHeight,
      }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

export function getLogoPdfDimensions(
  pixelWidth: number,
  pixelHeight: number,
): { widthMm: number; heightMm: number } {
  const fitted = fitLogoBox(
    pixelWidth,
    pixelHeight,
    EXPENSE_REPORT_LOGO_MAX_WIDTH_MM,
    EXPENSE_REPORT_LOGO_MAX_HEIGHT_MM,
  )

  // Keep height derived from width so mm sizing matches pixel aspect ratio exactly.
  const aspect = pixelWidth / pixelHeight
  const widthMm = fitted.width
  const heightMm = widthMm / aspect

  return { widthMm, heightMm }
}

export const EXPENSE_REPORT_TAX_RATE = 0.2

export type CategorySummaryRow = {
  category: string
  amount: number
}

export type ExpenseReportData = {
  vendor: string
  date: string
  invoiceNumber: string
  lineItems: Array<{
    index: number
    item: string
    category: string
    qty: string
    amount: number
  }>
  categorySummary: CategorySummaryRow[]
  subtotal: number
  tax: number
  total: number
}

export function formatReportAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—'
  }
  return value.toFixed(2)
}

function displayField(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

function sumLineItems(lineItems: SavedLineItem[]): number {
  return lineItems.reduce((sum, item) => sum + (item.amount ?? 0), 0)
}

export function buildCategorySummary(lineItems: SavedLineItem[]): CategorySummaryRow[] {
  const totals = new Map<string, number>()

  for (const item of lineItems) {
    const category = item.category?.trim() || 'Uncategorized'
    totals.set(category, (totals.get(category) ?? 0) + (item.amount ?? 0))
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

export function buildExpenseReportData(invoice: SavedInvoice): ExpenseReportData {
  const subtotal = invoice.subtotal_amount ?? sumLineItems(invoice.line_items)
  const tax = subtotal * EXPENSE_REPORT_TAX_RATE
  const total = invoice.total_amount ?? subtotal + tax

  return {
    vendor: displayField(invoice.issuer.name),
    date: displayField(invoice.invoice_date),
    invoiceNumber: displayField(invoice.invoice_number),
    lineItems: invoice.line_items.map((item, index) => ({
      index: index + 1,
      item: displayField(item.description),
      category: displayField(item.category),
      qty: item.quantity === null ? '—' : String(item.quantity),
      amount: item.amount ?? 0,
    })),
    categorySummary: buildCategorySummary(invoice.line_items),
    subtotal,
    tax,
    total,
  }
}

export function expenseReportFilename(invoice: SavedInvoice): string {
  const number = invoice.invoice_number?.trim().replace(/[^\w.-]+/g, '_') || `invoice-${invoice.id}`
  return `expense-report-${number}.pdf`
}
