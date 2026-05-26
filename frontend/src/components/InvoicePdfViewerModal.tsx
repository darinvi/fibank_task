import { useEffect, useId } from 'react'
import { getExpenseReportPdfUrl } from '../lib/api'
import type { SavedExpenseReportPdf } from '../types/invoice'
import './InvoicePdfViewerModal.css'
import './Modal.css'

type InvoicePdfViewerModalProps = {
  report: SavedExpenseReportPdf | null
  isOpen: boolean
  onClose: () => void
  onDownload: () => void
}

export function InvoicePdfViewerModal({
  report,
  isOpen,
  onClose,
  onDownload,
}: InvoicePdfViewerModalProps) {
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !report) {
    return null
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--wide invoice-pdf-viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>{report.filename}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body invoice-pdf-viewer-modal__body">
          <iframe
            className="invoice-pdf-viewer-modal__pdf"
            src={getExpenseReportPdfUrl(report.id)}
            title={report.filename}
          />
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn--primary" onClick={onDownload}>
            Download
          </button>
        </footer>
      </div>
    </div>
  )
}
