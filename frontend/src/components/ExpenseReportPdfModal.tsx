import { useEffect, useId, useState } from 'react'
import { generateExpenseReportPdf, getExpenseReportPdfUrl } from '../lib/api'
import type { SavedExpenseReportPdf, SavedInvoice } from '../types/invoice'
import { ExpenseReportPreview } from './ExpenseReportPreview'
import './ExpenseReportPdfModal.css'
import './Modal.css'

type ExpenseReportPdfModalProps = {
  invoice: SavedInvoice | null
  isOpen: boolean
  onClose: () => void
  onGenerated?: (report: SavedExpenseReportPdf) => void
}

type ModalPhase = 'preview' | 'generating' | 'viewer'

export function ExpenseReportPdfModal({
  invoice,
  isOpen,
  onClose,
  onGenerated,
}: ExpenseReportPdfModalProps) {
  const titleId = useId()
  const [phase, setPhase] = useState<ModalPhase>('preview')
  const [error, setError] = useState<string | null>(null)
  const [generatedReport, setGeneratedReport] = useState<SavedExpenseReportPdf | null>(null)

  useEffect(() => {
    if (invoice && isOpen) {
      setPhase('preview')
      setError(null)
      setGeneratedReport(null)
    }
  }, [invoice, isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && phase !== 'generating') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, phase, onClose])

  if (!isOpen || !invoice) {
    return null
  }

  const handleGenerate = async () => {
    setPhase('generating')
    setError(null)

    try {
      const report = await generateExpenseReportPdf(invoice.id)
      setGeneratedReport(report)
      onGenerated?.(report)
      setPhase('viewer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
      setPhase('preview')
    }
  }

  const handleBackHome = () => {
    setGeneratedReport(null)
    onClose()
  }

  const handleDownload = () => {
    if (!generatedReport) {
      return
    }

    const link = document.createElement('a')
    link.href = getExpenseReportPdfUrl(generatedReport.id)
    link.download = generatedReport.filename
    link.click()
  }

  const isGenerating = phase === 'generating'
  const isViewer = phase === 'viewer' && generatedReport !== null
  const canDismiss = !isGenerating

  const title =
    phase === 'generating'
      ? 'Generating expense report'
      : phase === 'viewer'
        ? 'Expense report'
        : 'Expense report preview'

  return (
    <div className="modal-backdrop" onClick={canDismiss ? onClose : undefined}>
      <div
        className={`modal modal--wide expense-report-modal${isViewer ? ' expense-report-modal--viewer' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="modal__close"
            onClick={isViewer ? handleBackHome : onClose}
            disabled={isGenerating}
            aria-label={isViewer ? 'Back home' : 'Close'}
          >
            ×
          </button>
        </header>

        <div className="modal__body expense-report-modal__body">
          {phase === 'preview' && <ExpenseReportPreview invoice={invoice} />}

          {phase === 'generating' && (
            <div className="expense-report-modal__generating" role="status" aria-live="polite">
              <div className="expense-report-modal__spinner" aria-hidden="true" />
              <p>Generating…</p>
            </div>
          )}

          {isViewer && (
            <iframe
              className="expense-report-modal__pdf"
              src={getExpenseReportPdfUrl(generatedReport.id)}
              title={generatedReport.filename}
            />
          )}

          {error && <p className="modal__error">{error}</p>}
        </div>

        <footer className="modal__footer">
          {phase === 'preview' && (
            <>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Back
              </button>
              <button type="button" className="btn btn--primary" onClick={() => void handleGenerate()}>
                Generate
              </button>
            </>
          )}

          {isViewer && (
            <>
              <button type="button" className="btn btn--ghost" onClick={handleBackHome}>
                Back home
              </button>
              <button type="button" className="btn btn--primary" onClick={handleDownload}>
                Download
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
