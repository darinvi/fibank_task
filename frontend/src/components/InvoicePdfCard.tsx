import { useEffect, useRef } from 'react'
import { displayValue } from '../lib/format'
import { getExpenseReportPdfUrl } from '../lib/api'
import { renderPdfThumbnail } from '../lib/pdfPreview'
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

function ViewIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 4.5c-3.8 0-6.9 2.8-8 6.5 1.1 3.7 4.2 6.5 8 6.5s6.9-2.8 8-6.5c-1.1-3.7-4.2-6.5-8-6.5zm0 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 2.5a1 1 0 0 1 1 1v7.6l2.1-2.1 1.4 1.4L10 14.9 5.5 10.4l1.4-1.4 2.1 2.1V3.5a1 1 0 0 1 1-1zM4 15.5h12v2H4v-2z"
      />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h6l1 2h4v2H3V5h4l1-2zm-1 6h2v7H6V9zm4 0h2v7h-2V9zM5 18h10a1 1 0 0 0 1-1V9H4v8a1 1 0 0 0 1 1z"
      />
    </svg>
  )
}

function InvoicePdfCardPreview({ reportId }: { reportId: number }) {
  const previewRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = previewRef.current
    if (!container) {
      return
    }

    let cancelled = false

    const render = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (!width || !height) {
        return
      }

      void renderPdfThumbnail(
        getExpenseReportPdfUrl(reportId),
        container,
        width,
        height,
        'invoice-pdf-card__page',
      ).catch(() => {
        if (!cancelled) {
          container.replaceChildren()
        }
      })
    }

    render()

    const observer = new ResizeObserver(render)
    observer.observe(container)

    return () => {
      cancelled = true
      observer.disconnect()
      container.replaceChildren()
    }
  }, [reportId])

  return <span ref={previewRef} className="invoice-pdf-card__thumbnail" aria-hidden="true" />
}

export function InvoicePdfCard({ report, onView, onDownload, onDelete }: InvoicePdfCardProps) {
  return (
    <article className="invoice-pdf-card">
      <button type="button" className="invoice-pdf-card__preview" onClick={onView}>
        <InvoicePdfCardPreview reportId={report.id} />
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
          <button
            type="button"
            className="invoice-pdf-card__action invoice-pdf-card__action--view"
            onClick={onView}
            aria-label="View PDF"
            title="View"
          >
            <ViewIcon />
          </button>
          <button
            type="button"
            className="invoice-pdf-card__action invoice-pdf-card__action--download"
            onClick={onDownload}
            aria-label="Download PDF"
            title="Download"
          >
            <DownloadIcon />
          </button>
          <button
            type="button"
            className="invoice-pdf-card__action invoice-pdf-card__action--delete"
            onClick={onDelete}
            aria-label="Delete PDF"
            title="Delete"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>
    </article>
  )
}
