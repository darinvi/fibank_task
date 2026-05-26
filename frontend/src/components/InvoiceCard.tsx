import { displayValue, formatMoney, formatNumber } from '../lib/format'
import { getInvoiceImageUrl } from '../lib/api'
import type { SavedInvoice } from '../types/invoice'
import './InvoiceCard.css'

type InvoiceCardProps = {
  invoice: SavedInvoice
  onOpen: () => void
  onGeneratePdf: () => void
  onDelete: () => void
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.3 3.7a1.2 1.2 0 0 1 1.7 1.7l-8.6 8.6-2.2.6.6-2.2 8.5-8.7zm-.8 1.7 1.6 1.6 1.5-1.5-1.6-1.6-1.5 1.5z"
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

function PdfIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        fillOpacity="0.12"
        d="M6 2h6l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        d="M6 2h6l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"
      />
      <path fill="currentColor" fillOpacity="0.35" d="M12 2v4h4" />
      <text
        x="10"
        y="13.5"
        textAnchor="middle"
        fontSize="4.5"
        fontWeight="700"
        fill="currentColor"
        fontFamily="system-ui, Segoe UI, sans-serif"
      >
        PDF
      </text>
    </svg>
  )
}

export function InvoiceCard({ invoice, onOpen, onGeneratePdf, onDelete }: InvoiceCardProps) {
  return (
    <article className="invoice-card">
      <button type="button" className="invoice-card__open" onClick={onOpen}>
        <div className="invoice-card__image-wrap">
          <img
            src={getInvoiceImageUrl(invoice.id)}
            alt={`Invoice ${displayValue(invoice.invoice_number)}`}
            className="invoice-card__image"
            loading="lazy"
          />
        </div>

        <div className="invoice-card__content">
          <div className="invoice-card__top">
            <div className="invoice-card__title">
              <span className="invoice-card__number">{displayValue(invoice.invoice_number)}</span>
              <span className="invoice-card__date">{displayValue(invoice.invoice_date)}</span>
            </div>
            <div className="invoice-card__amounts">
              <strong className="invoice-card__total">
                {formatMoney(invoice.total_amount, invoice.currency)}
              </strong>
              {invoice.subtotal_amount != null && (
                <span className="invoice-card__subtotal">
                  Subtotal {formatMoney(invoice.subtotal_amount, invoice.currency)}
                </span>
              )}
            </div>
          </div>

          <p className="invoice-card__parties">
            <span>{displayValue(invoice.issuer.name)}</span>
            <span className="invoice-card__arrow">→</span>
            <span>{displayValue(invoice.receiver.name)}</span>
          </p>

          {invoice.line_items.length > 0 && (
            <div className="invoice-card__items">
              <div className="invoice-card__items-head" aria-hidden="true">
                <span>Item</span>
                <span>Category</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Total</span>
              </div>
              <ul className="invoice-card__items-list">
                {invoice.line_items.map((item) => (
                  <li key={item.id} className="invoice-card__item">
                    <span className="invoice-card__item-desc">{displayValue(item.description)}</span>
                    <span className="invoice-card__item-category">{displayValue(item.category)}</span>
                    <span>{formatNumber(item.quantity)}</span>
                    <span>{formatNumber(item.unit_price)}</span>
                    <span>{formatNumber(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </button>

      <div className="invoice-card__actions">
        <button
          type="button"
          className="invoice-card__action invoice-card__action--edit"
          onClick={onOpen}
          aria-label="Edit invoice"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="invoice-card__action invoice-card__action--pdf"
          onClick={(event) => {
            event.stopPropagation()
            onGeneratePdf()
          }}
          aria-label="Generate expense report PDF"
          title="Generate PDF"
        >
          <PdfIcon />
        </button>
        <button
          type="button"
          className="invoice-card__action invoice-card__action--delete"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label="Delete invoice"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </article>
  )
}
