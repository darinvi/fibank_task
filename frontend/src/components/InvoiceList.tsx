import { useCallback, useEffect, useState } from 'react'
import {
  deleteExpenseReport,
  deleteInvoice,
  downloadExpenseReportPdf,
  listExpenseReports,
  listInvoices,
} from '../lib/api'
import type { SavedExpenseReportPdf, SavedInvoice } from '../types/invoice'
import { ConfirmDialog } from './ConfirmDialog'
import { InvoiceCard } from './InvoiceCard'
import { InvoicePdfCard } from './InvoicePdfCard'
import { InvoicePdfViewerModal } from './InvoicePdfViewerModal'
import { ExpenseReportPdfModal } from './ExpenseReportPdfModal'
import { UploadInvoiceModal } from './UploadInvoiceModal'
import './InvoiceList.css'
import './Modal.css'

type ListTab = 'invoices' | 'pdfs'

const TAB_COPY: Record<ListTab, { title: string; description: string; empty: string }> = {
  invoices: {
    title: 'Your invoices',
    description: 'Review extracted data, line items, and invoice PDFs.',
    empty: 'No invoices yet. Upload your first invoice to get started.',
  },
  pdfs: {
    title: 'Your PDFs',
    description: 'Generated expense report PDFs saved from your invoices.',
    empty: 'No generated PDFs yet. Open an invoice and click Generate.',
  },
}

export function InvoiceList() {
  const [activeTab, setActiveTab] = useState<ListTab>('invoices')
  const [invoices, setInvoices] = useState<SavedInvoice[]>([])
  const [generatedPdfs, setGeneratedPdfs] = useState<SavedExpenseReportPdf[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [invoiceForPdf, setInvoiceForPdf] = useState<SavedInvoice | null>(null)
  const [reportForPdfView, setReportForPdfView] = useState<SavedExpenseReportPdf | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null)
  const [reportToDelete, setReportToDelete] = useState<SavedExpenseReportPdf | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const tabCopy = TAB_COPY[activeTab]
  const activeItems = activeTab === 'invoices' ? invoices : generatedPdfs

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

  const loadGeneratedPdfs = useCallback(async (background = false) => {
    if (background) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
      setError(null)
    }

    try {
      const data = await listExpenseReports()
      setGeneratedPdfs(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load generated PDFs')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const loadActiveTab = useCallback(
    (background = false) => {
      if (activeTab === 'invoices') {
        return loadInvoices(background)
      }
      return loadGeneratedPdfs(background)
    },
    [activeTab, loadInvoices, loadGeneratedPdfs],
  )

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
    void loadActiveTab()
  }, [loadActiveTab])

  const handleSaved = (updated: SavedInvoice) => {
    setInvoices((current) => current.map((invoice) => (invoice.id === updated.id ? updated : invoice)))
  }

  const handleExpenseReportGenerated = (report: SavedExpenseReportPdf) => {
    setGeneratedPdfs((current) => [report, ...current.filter((item) => item.id !== report.id)])
  }

  const handleDownloadPdf = async (report: SavedExpenseReportPdf) => {
    try {
      await downloadExpenseReportPdf(report.id, report.filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download PDF')
    }
  }

  const handleConfirmDeleteInvoice = async () => {
    if (!invoiceToDelete) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteInvoice(invoiceToDelete.id)
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceToDelete.id))
      setGeneratedPdfs((current) => current.filter((report) => report.invoice_id !== invoiceToDelete.id))
      if (invoiceForPdf?.id === invoiceToDelete.id) {
        setInvoiceForPdf(null)
      }
      if (reportForPdfView?.invoice_id === invoiceToDelete.id) {
        setReportForPdfView(null)
      }
      setInvoiceToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete invoice')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmDeleteReport = async () => {
    if (!reportToDelete) {
      return
    }

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteExpenseReport(reportToDelete.id)
      setGeneratedPdfs((current) => current.filter((report) => report.id !== reportToDelete.id))
      if (reportForPdfView?.id === reportToDelete.id) {
        setReportForPdfView(null)
      }
      setReportToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete PDF')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="invoice-list">
      <div className="invoice-list__header">
        <div>
          <div className="invoice-list__tabs" role="tablist" aria-label="Invoice library views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'invoices'}
              className={`invoice-list__tab${activeTab === 'invoices' ? ' invoice-list__tab--active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              Your invoices
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pdfs'}
              className={`invoice-list__tab${activeTab === 'pdfs' ? ' invoice-list__tab--active' : ''}`}
              onClick={() => {
                setActiveTab('pdfs')
                void loadGeneratedPdfs()
              }}
            >
              Your PDFs
            </button>
          </div>
          <h2>{tabCopy.title}</h2>
          <p>{tabCopy.description}</p>
        </div>
        <div className="invoice-list__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void loadActiveTab(true)}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {activeTab === 'invoices' && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setIsUploadOpen(true)}
              disabled={isUploading}
              aria-busy={isUploading}
            >
              {isUploading && <span className="spinner" aria-hidden="true" />}
              {isUploading ? 'Uploading…' : 'Upload invoice'}
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="invoice-list__empty">
          {activeTab === 'invoices' ? 'Loading invoices…' : 'Loading PDFs…'}
        </div>
      )}

      {!isLoading && error && activeItems.length === 0 && (
        <div className="invoice-list__empty invoice-list__empty--error">
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={() => void loadActiveTab()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && activeItems.length === 0 && (
        <div className="invoice-list__empty">
          <p>{tabCopy.empty}</p>
        </div>
      )}

      {!isLoading && activeItems.length > 0 && (
        <>
          {error && <p className="invoice-list__banner-error">{error}</p>}
          {activeTab === 'invoices' ? (
            <div className="invoice-list__items">
              {invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onSaved={handleSaved}
                  onGeneratePdf={() => setInvoiceForPdf(invoice)}
                  onDelete={() => {
                    setDeleteError(null)
                    setInvoiceToDelete(invoice)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="invoice-list__pdf-grid">
              {generatedPdfs.map((report) => (
                <InvoicePdfCard
                  key={report.id}
                  report={report}
                  onView={() => setReportForPdfView(report)}
                  onDownload={() => void handleDownloadPdf(report)}
                  onDelete={() => {
                    setDeleteError(null)
                    setReportToDelete(report)
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <UploadInvoiceModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        onSubmittingChange={setIsUploading}
      />

      <ExpenseReportPdfModal
        invoice={invoiceForPdf}
        isOpen={invoiceForPdf !== null}
        onClose={() => setInvoiceForPdf(null)}
        onGenerated={handleExpenseReportGenerated}
      />

      <InvoicePdfViewerModal
        report={reportForPdfView}
        isOpen={reportForPdfView !== null}
        onClose={() => setReportForPdfView(null)}
        onDownload={() => {
          if (reportForPdfView) {
            void handleDownloadPdf(reportForPdfView)
          }
        }}
      />

      <ConfirmDialog
        isOpen={invoiceToDelete !== null}
        title="Delete invoice?"
        message="Are you sure you want to delete this invoice? Its stored PDF and any generated expense reports will be removed."
        error={deleteError}
        confirmLabel="Yes"
        cancelLabel="No"
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDeleteInvoice()}
        onCancel={() => {
          if (!isDeleting) {
            setInvoiceToDelete(null)
            setDeleteError(null)
          }
        }}
      />

      <ConfirmDialog
        isOpen={reportToDelete !== null}
        title="Delete generated PDF?"
        message="Are you sure you want to delete this expense report PDF?"
        error={deleteError}
        confirmLabel="Yes"
        cancelLabel="No"
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDeleteReport()}
        onCancel={() => {
          if (!isDeleting) {
            setReportToDelete(null)
            setDeleteError(null)
          }
        }}
      />
    </section>
  )
}
