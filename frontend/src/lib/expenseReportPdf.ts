import { jsPDF } from 'jspdf'
import type { SavedInvoice } from '../types/invoice'
import {
  EXPENSE_REPORT_LOGO_PATH,
  EXPENSE_REPORT_TAX_RATE,
  buildExpenseReportData,
  expenseReportFilename,
  formatReportAmount,
  getLogoPdfDimensions,
  prepareExpenseReportLogo,
} from './expenseReport'

const FONT = 'courier'
const FONT_SIZE = 9
const TITLE_SIZE = 11
const LINE_HEIGHT = 4.5

function drawHorizontalRule(doc: jsPDF, x: number, y: number, width: number) {
  doc.line(x, y, x + width, y)
}

function drawSummaryRow(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  amount: string,
) {
  doc.setFont(FONT, 'normal')
  doc.setFontSize(FONT_SIZE)
  doc.text(label, x, y)

  const amountWidth = doc.getTextWidth(amount)
  const amountX = x + width - amountWidth
  const labelWidth = doc.getTextWidth(`${label} `)
  const dotsStart = x + labelWidth
  const dotsEnd = amountX - 2
  const dotWidth = doc.getTextWidth('.')
  const dotCount = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotWidth))

  if (dotCount > 0) {
    doc.text('.'.repeat(dotCount), dotsStart, y)
  }

  doc.text(amount, amountX, y)
}

export async function generateExpenseReportPdf(invoice: SavedInvoice): Promise<void> {
  const report = buildExpenseReportData(invoice)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 18
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const logo = await prepareExpenseReportLogo(EXPENSE_REPORT_LOGO_PATH)
  if (logo) {
    const imageProps = doc.getImageProperties(logo.dataUrl)
    const { widthMm, heightMm } = getLogoPdfDimensions(imageProps.width, imageProps.height)

    doc.addImage(logo.dataUrl, logo.format, margin, y, widthMm, heightMm, undefined, 'NONE')
    y += heightMm + 4
  }

  doc.setFont(FONT, 'bold')
  doc.setFontSize(TITLE_SIZE)
  doc.text('EXPENSE REPORT', pageWidth / 2, y, { align: 'center' })
  y += 3
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT

  doc.setFont(FONT, 'normal')
  doc.setFontSize(FONT_SIZE)
  doc.text(`Vendor: ${report.vendor}`, margin, y)
  y += LINE_HEIGHT
  doc.text(`Date: ${report.date}`, margin, y)
  y += LINE_HEIGHT
  doc.text(`Invoice#: ${report.invoiceNumber}`, margin, y)
  y += 3
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT + 1

  const columns = [
    { label: '#', width: 8, align: 'right' as const },
    { label: 'Item', width: 52, align: 'left' as const },
    { label: 'Category', width: 34, align: 'left' as const },
    { label: 'Qty', width: 14, align: 'right' as const },
    { label: 'Amount', width: 22, align: 'right' as const },
  ]

  doc.setFont(FONT, 'bold')
  let columnX = margin
  for (const column of columns) {
    doc.text(column.label, columnX + (column.align === 'right' ? column.width - 1 : 0), y, {
      align: column.align,
    })
    columnX += column.width
  }
  y += 2
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT

  doc.setFont(FONT, 'normal')
  for (const row of report.lineItems) {
    if (y > doc.internal.pageSize.getHeight() - margin - 40) {
      doc.addPage()
      y = margin
    }

    const values = [
      String(row.index),
      row.item,
      row.category,
      row.qty,
      formatReportAmount(row.amount),
    ]

    columnX = margin
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index]
      const value = values[index]
      const truncated =
        column.align === 'left' && doc.getTextWidth(value) > column.width - 1
          ? `${value.slice(0, Math.max(0, value.length - 3))}...`
          : value

      doc.text(truncated, columnX + (column.align === 'right' ? column.width - 1 : 0), y, {
        align: column.align,
      })
      columnX += column.width
    }

    y += LINE_HEIGHT
  }

  y += 2
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT + 1

  doc.setFont(FONT, 'bold')
  doc.text('CATEGORY SUMMARY', margin, y)
  y += LINE_HEIGHT
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT

  doc.setFont(FONT, 'normal')
  for (const row of report.categorySummary) {
    drawSummaryRow(doc, margin, y, contentWidth, row.category, formatReportAmount(row.amount))
    y += LINE_HEIGHT
  }

  y += 1
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT

  doc.text(`Subtotal: ${formatReportAmount(report.subtotal)}`, margin, y)
  y += LINE_HEIGHT
  doc.text(`Tax (${Math.round(EXPENSE_REPORT_TAX_RATE * 100)}%): ${formatReportAmount(report.tax)}`, margin, y)
  y += LINE_HEIGHT + 1
  doc.setFont(FONT, 'bold')
  doc.text(`TOTAL: ${formatReportAmount(report.total)}`, margin, y)
  y += 3
  drawHorizontalRule(doc, margin, y, contentWidth)

  doc.save(expenseReportFilename(invoice))
}
