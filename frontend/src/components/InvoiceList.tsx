import { useCallback, useEffect, useState } from 'react'
import { deleteInvoice, listInvoices } from '../lib/api'
import type { SavedInvoice } from '../types/invoice'
import { ConfirmDialog } from './ConfirmDialog'
import { InvoiceCard } from './InvoiceCard'
import { InvoiceDetailModal } from './InvoiceDetailModal'
import { UploadInvoiceModal } from './UploadInvoiceModal'
import './InvoiceList.css'
import './Modal.css'

export function InvoiceList() {
  const [invoices, setInvoices] = useState<SavedInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<SavedInvoice | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadInvoices = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await listInvoices()
      setInvoices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices')
    } finally {
      setIsLoading(false)
    }
  }, [])

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
        <button type="button" className="btn btn--primary" onClick={() => setIsUploadOpen(true)}>
          Upload invoice
        </button>
      </div>

      {isLoading && <div className="invoice-list__empty">Loading invoices…</div>}

      {!isLoading && error && (
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

      {!isLoading && !error && invoices.length > 0 && (
        <div className="invoice-list__items">
          {invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onOpen={() => setSelectedInvoice(invoice)}
              onDelete={() => {
                setDeleteError(null)
                setInvoiceToDelete(invoice)
              }}
            />
          ))}
        </div>
      )}

      <UploadInvoiceModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => void loadInvoices()}
      />

      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={selectedInvoice !== null}
        onClose={() => setSelectedInvoice(null)}
        onSaved={handleSaved}
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
