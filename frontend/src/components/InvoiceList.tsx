import { useCallback, useEffect, useState } from 'react'
import { deleteInvoice, listInvoices } from '../lib/api'
import type { SavedInvoice } from '../types/invoice'
import { ConfirmDialog } from './ConfirmDialog'
import { InvoiceCard } from './InvoiceCard'
import { ExpenseReportPdfModal } from './ExpenseReportPdfModal'
import { InvoiceDetailModal } from './InvoiceDetailModal'
import { UploadInvoiceModal } from './UploadInvoiceModal'
import './InvoiceList.css'
import './Modal.css'

export function InvoiceList() {
  const [invoices, setInvoices] = useState<SavedInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null)
  const [invoiceForPdf, setInvoiceForPdf] = useState<SavedInvoice | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadInvoices = useCallback(async (background = false) => {
    if (background) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
      setError(null)
    }

    try {
      const data = await listInvoices()
      setInvoices(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const upsertInvoice = useCallback((invoice: SavedInvoice) => {
    setInvoices((current) => {
      const index = current.findIndex((item) => item.id === invoice.id)
      if (index === -1) {
        return [invoice, ...current]
      }

      const next = [...current]
      next[index] = invoice
      return next
    })
  }, [])

  const handleUploadSuccess = (invoice: SavedInvoice) => {
    upsertInvoice(invoice)
    void loadInvoices(true)
  }

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  const handleSaved = (updated: SavedInvoice) => {
    setInvoices((current) => current.map((invoice) => (invoice.id === updated.id ? updated : invoice)))
  }

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteInvoice(invoiceToDelete.id)
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceToDelete.id))
      if (selectedInvoice?.id === invoiceToDelete.id) {
        setSelectedInvoice(null)
      }
      setInvoiceToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete invoice')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="invoice-list">
      <div className="invoice-list__header">
        <div>
          <h2>Your invoices</h2>
          <p>Review extracted data, line items, and invoice images.</p>
        </div>
        <div className="invoice-list__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void loadInvoices(true)}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh invoices"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setIsUploadOpen(true)}>
            Upload invoice
          </button>
        </div>
      </div>

      {isLoading && <div className="invoice-list__empty">Loading invoices…</div>}

      {!isLoading && error && invoices.length === 0 && (
        <div className="invoice-list__empty invoice-list__empty--error">
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={() => void loadInvoices()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && invoices.length === 0 && (
        <div className="invoice-list__empty">
          <p>No invoices yet. Upload your first invoice to get started.</p>
        </div>
      )}

      {!isLoading && invoices.length > 0 && (
        <>
          {error && <p className="invoice-list__banner-error">{error}</p>}
          <div className="invoice-list__items">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onOpen={() => setSelectedInvoice(invoice)}
                onGeneratePdf={() => setInvoiceForPdf(invoice)}
                onDelete={() => {
                  setDeleteError(null)
                  setInvoiceToDelete(invoice)
                }}
              />
            ))}
          </div>
        </>
      )}

      <UploadInvoiceModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={selectedInvoice !== null}
        onClose={() => setSelectedInvoice(null)}
        onSaved={handleSaved}
      />

      <ExpenseReportPdfModal
        invoice={invoiceForPdf}
        isOpen={invoiceForPdf !== null}
        onClose={() => setInvoiceForPdf(null)}
      />

      <ConfirmDialog
        isOpen={invoiceToDelete !== null}
        title="Delete invoice?"
        message="Are you sure you want to delete this invoice?"
        error={deleteError}
        confirmLabel="Yes"
        cancelLabel="No"
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!isDeleting) {
            setInvoiceToDelete(null)
            setDeleteError(null)
          }
        }}
      />
    </section>
  )
}
