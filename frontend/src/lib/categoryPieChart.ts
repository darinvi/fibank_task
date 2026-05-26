import { getCategoryColor, type CategorySummaryRow } from './expenseReport'

export const CATEGORY_PIE_CHART_SIZE_PX = 240

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export function renderCategoryPieChartToDataUrl(
  data: CategorySummaryRow[],
  sizePx = CATEGORY_PIE_CHART_SIZE_PX,
): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = sizePx
  canvas.height = sizePx

  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  const center = sizePx / 2
  const radius = sizePx / 2 - 2
  const total = data.reduce((sum, row) => sum + Math.max(row.amount, 0), 0)

  if (total <= 0 || data.length === 0) {
    context.beginPath()
    context.arc(center, center, radius, 0, Math.PI * 2)
    context.fillStyle = '#e2e8f0'
    context.fill()
    context.strokeStyle = '#cbd5e1'
    context.lineWidth = 1
    context.stroke()
    return canvas.toDataURL('image/png')
  }

  let startAngle = -Math.PI / 2

  for (let index = 0; index < data.length; index += 1) {
    const row = data[index]
    const amount = Math.max(row.amount, 0)
    if (amount <= 0) {
      continue
    }

    const sliceAngle = (amount / total) * Math.PI * 2
    const endAngle = startAngle + sliceAngle
    const { r, g, b } = hexToRgb(getCategoryColor(index))

    context.beginPath()
    context.moveTo(center, center)
    if (sliceAngle >= Math.PI * 2 - 0.001) {
      context.arc(center, center, radius, 0, Math.PI * 2)
    } else {
      context.arc(center, center, radius, startAngle, endAngle)
    }
    context.closePath()
    context.fillStyle = `rgb(${r}, ${g}, ${b})`
    context.fill()
    context.strokeStyle = '#ffffff'
    context.lineWidth = 2
    context.stroke()

    startAngle = endAngle
  }

  return canvas.toDataURL('image/png')
}
