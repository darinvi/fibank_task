import { useState } from 'react'
import { UploadInvoiceModal } from './UploadInvoiceModal'
import './InvoiceList.css'

export function InvoiceList() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <section className="invoice-list">
      <div className="invoice-list__header">
        <div>
          <h2>Your invoices</h2>
          <p>Uploaded invoices will appear here.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
          Upload invoice
        </button>
      </div>

      <div className="invoice-list__empty">
        <p>No invoices yet. Upload your first invoice to get started.</p>
      </div>

      <UploadInvoiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </section>
  )
}
