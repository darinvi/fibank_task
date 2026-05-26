import type { SavedInvoice, SavedLineItem } from '../types/invoice'

export const EXPENSE_REPORT_LOGO_PATH = '/expense-report-logo.png'

export type CategorySummaryRow = {
  category: string
  amount: number
}

const CATEGORY_CHART_COLORS = [
  '#334155',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
] as const

export function getCategoryColor(index: number): string {
  return CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]
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
  tax: number | null
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

function buildCategorySummary(lineItems: SavedLineItem[]): CategorySummaryRow[] {
  const totals = new Map<string, number>()

  for (const item of lineItems) {
    const category = item.category?.trim() || 'Uncategorized'
    totals.set(category, (totals.get(category) ?? 0) + (item.amount ?? 0))
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

function resolveTaxAmount(invoice: SavedInvoice, subtotal: number): number | null {
  if (invoice.tax_amount != null) {
    return invoice.tax_amount
  }
  if (invoice.total_amount != null) {
    return invoice.total_amount - subtotal
  }
  return null
}

function resolveTotalAmount(invoice: SavedInvoice, subtotal: number, tax: number | null): number {
  if (invoice.total_amount != null) {
    return invoice.total_amount
  }
  if (tax != null) {
    return subtotal + tax
  }
  return subtotal
}

export function buildExpenseReportData(invoice: SavedInvoice): ExpenseReportData {
  const subtotal = invoice.subtotal_amount ?? sumLineItems(invoice.line_items)
  const tax = resolveTaxAmount(invoice, subtotal)
  const total = resolveTotalAmount(invoice, subtotal, tax)

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
