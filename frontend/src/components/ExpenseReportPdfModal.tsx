import { useEffect, useId, useState } from 'react'
import { generateExpenseReportPdf } from '../lib/expenseReportPdf'
import type { SavedInvoice } from '../types/invoice'
import { ExpenseReportPreview } from './ExpenseReportPreview'
import './ExpenseReportPdfModal.css'
import './Modal.css'

type ExpenseReportPdfModalProps = {
  invoice: SavedInvoice | null
  isOpen: boolean
  onClose: () => void
}

export function ExpenseReportPdfModal({ invoice, isOpen, onClose }: ExpenseReportPdfModalProps) {
  const titleId = useId()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (invoice && isOpen) {
      setIsGenerating(false)
      setError(null)
    }
  }, [invoice, isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isGenerating) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isGenerating, onClose])

  if (!isOpen || !invoice) {
    return null
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      await generateExpenseReportPdf(invoice)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF')
      setIsGenerating(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={isGenerating ? undefined : onClose}>
      <div
        className="modal modal--wide expense-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>Expense report preview</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="modal__body expense-report-modal__body">
          <ExpenseReportPreview invoice={invoice} />
          {error && <p className="modal__error">{error}</p>}
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isGenerating}>
            Back
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate'}
          </button>
        </footer>
      </div>
    </div>
  )
}
