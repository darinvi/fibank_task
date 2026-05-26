import { getCategoryColor } from '../lib/expenseReport'
import type { CategorySummaryRow } from '../lib/expenseReport'
import './CategoryPieChart.css'

type CategoryPieChartProps = {
  data: CategorySummaryRow[]
}

const SIZE = 120
const RADIUS = 50
const CENTER = SIZE / 2

function polarToCartesian(angleDegrees: number): { x: number; y: number } {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180
  return {
    x: CENTER + RADIUS * Math.cos(angleRadians),
    y: CENTER + RADIUS * Math.sin(angleRadians),
  }
}

function describeSlicePath(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(endAngle)
  const end = polarToCartesian(startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1

  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const total = data.reduce((sum, row) => sum + Math.max(row.amount, 0), 0)
  const hasPositiveTotal = total > 0

  let currentAngle = 0
  const slices = data.map((row, index) => {
    const color = getCategoryColor(index)
    const sliceAngle = hasPositiveTotal ? (Math.max(row.amount, 0) / total) * 360 : 0
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    currentAngle = endAngle

    if (sliceAngle <= 0) {
      return null
    }

    if (sliceAngle >= 359.99) {
      return <circle key={row.category} cx={CENTER} cy={CENTER} r={RADIUS} fill={color} />
    }

    return (
      <path
        key={row.category}
        d={describeSlicePath(startAngle, endAngle)}
        fill={color}
        stroke="#fff"
        strokeWidth={1}
      />
    )
  })

  const label =
    data.length === 0
      ? 'No category data'
      : `Category breakdown: ${data.map((row) => row.category).join(', ')}`

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="category-pie-chart"
      role="img"
      aria-label={label}
    >
      {!hasPositiveTotal && (
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={1} />
      )}
      {slices}
    </svg>
  )
}
