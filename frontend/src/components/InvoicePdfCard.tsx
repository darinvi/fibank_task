import { displayValue } from '../lib/format'
import { getExpenseReportPdfUrl } from '../lib/api'
import type { SavedExpenseReportPdf } from '../types/invoice'
import './InvoicePdfCard.css'

type InvoicePdfCardProps = {
  report: SavedExpenseReportPdf
  onView: () => void
  onDownload: () => void
  onDelete: () => void
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export function InvoicePdfCard({ report, onView, onDownload, onDelete }: InvoicePdfCardProps) {
  return (
    <article className="invoice-pdf-card">
      <button type="button" className="invoice-pdf-card__preview" onClick={onView}>
        <iframe
          src={getExpenseReportPdfUrl(report.id)}
          title={report.filename}
          className="invoice-pdf-card__iframe"
          loading="lazy"
        />
      </button>

      <div className="invoice-pdf-card__meta">
        <button type="button" className="invoice-pdf-card__title" onClick={onView}>
          <span className="invoice-pdf-card__filename">{report.filename}</span>
          <span className="invoice-pdf-card__subtitle">
            {displayValue(report.invoice_number)} · {displayValue(report.invoice_date)}
          </span>
          <span className="invoice-pdf-card__vendor">{displayValue(report.issuer_name)}</span>
          <span className="invoice-pdf-card__generated">Generated {formatGeneratedAt(report.created_at)}</span>
        </button>

        <div className="invoice-pdf-card__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onView}>
            View
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDownload}>
            Download
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm invoice-pdf-card__delete"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}
