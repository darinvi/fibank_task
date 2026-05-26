import { jsPDF } from 'jspdf'
import type { SavedInvoice } from '../types/invoice'
import { renderCategoryPieChartToDataUrl } from './categoryPieChart'
import {
  EXPENSE_REPORT_LOGO_PATH,
  buildExpenseReportData,
  expenseReportFilename,
  formatReportAmount,
  getCategoryColor,
  getLogoPdfDimensions,
  prepareExpenseReportLogo,
} from './expenseReport'

const FONT = 'courier'
const FONT_SIZE = 9
const TITLE_SIZE = 11
const LINE_HEIGHT = 4.5
const PIE_CHART_SIZE_MM = 32
const PIE_CHART_GAP_MM = 4
const SUMMARY_BLOCK_PADDING_MM = 2
const SWATCH_SIZE_MM = 2.5
const SWATCH_GAP_MM = 1.5
const SWATCH_BASELINE_OFFSET_MM = 2.8

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function drawCategorySwatch(doc: jsPDF, x: number, baselineY: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  doc.setFillColor(r, g, b)
  doc.rect(x, baselineY - SWATCH_BASELINE_OFFSET_MM, SWATCH_SIZE_MM, SWATCH_SIZE_MM, 'F')
}

function drawSummaryRow(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  amount: string,
  color?: string,
) {
  let contentX = x

  if (color) {
    drawCategorySwatch(doc, contentX, y, color)
    contentX += SWATCH_SIZE_MM + SWATCH_GAP_MM
  }

  doc.setFont(FONT, 'normal')
  doc.setFontSize(FONT_SIZE)
  doc.text(label, contentX, y)

  const amountWidth = doc.getTextWidth(amount)
  const amountX = x + width - amountWidth
  const labelWidth = doc.getTextWidth(`${label} `)
  const dotsStart = contentX + labelWidth
  const dotsEnd = amountX - 2
  const dotWidth = doc.getTextWidth('.')
  const dotCount = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotWidth))

  if (dotCount > 0) {
    doc.text('.'.repeat(dotCount), dotsStart, y)
  }

  doc.text(amount, amountX, y)
}

function drawHorizontalRule(doc: jsPDF, x: number, y: number, width: number) {
  doc.line(x, y, x + width, y)
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
  const summaryStartY = y
  const hasCategorySummary = report.categorySummary.length > 0
  const pieChartDataUrl = hasCategorySummary
    ? renderCategoryPieChartToDataUrl(report.categorySummary)
    : null
  const showPieChart = pieChartDataUrl !== null && hasCategorySummary
  const summaryRowsHeight = report.categorySummary.length * LINE_HEIGHT
  const summaryBlockHeight = showPieChart
    ? Math.max(PIE_CHART_SIZE_MM, summaryRowsHeight) + SUMMARY_BLOCK_PADDING_MM * 2
    : summaryRowsHeight
  const pieY = summaryStartY + (summaryBlockHeight - PIE_CHART_SIZE_MM) / 2
  const summaryY = summaryStartY + (summaryBlockHeight - summaryRowsHeight) / 2

  if (showPieChart) {
    doc.addImage(pieChartDataUrl, 'PNG', margin, pieY, PIE_CHART_SIZE_MM, PIE_CHART_SIZE_MM, undefined, 'FAST')
  }

  const summaryTextX = showPieChart ? margin + PIE_CHART_SIZE_MM + PIE_CHART_GAP_MM : margin
  const summaryTextWidth = contentWidth - (summaryTextX - margin)
  let rowY = summaryY

  for (let index = 0; index < report.categorySummary.length; index += 1) {
    const row = report.categorySummary[index]
    drawSummaryRow(
      doc,
      summaryTextX,
      rowY,
      summaryTextWidth,
      row.category,
      formatReportAmount(row.amount),
      getCategoryColor(index),
    )
    rowY += LINE_HEIGHT
  }

  if (hasCategorySummary) {
    y = summaryStartY + summaryBlockHeight
  }

  y += 1
  drawHorizontalRule(doc, margin, y, contentWidth)
  y += LINE_HEIGHT

  doc.text(`Subtotal: ${formatReportAmount(report.subtotal)}`, margin, y)
  y += LINE_HEIGHT
  doc.text(`Tax: ${formatReportAmount(report.tax)}`, margin, y)
  y += LINE_HEIGHT + 1
  doc.setFont(FONT, 'bold')
  doc.text(`TOTAL: ${formatReportAmount(report.total)}`, margin, y)
  y += 3
  drawHorizontalRule(doc, margin, y, contentWidth)

  doc.save(expenseReportFilename(invoice))
}
