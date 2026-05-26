import { useEffect, useState } from 'react'
import { displayValue, formatMoney, formatNumber } from '../lib/format'
import { getInvoicePdfUrl, updateInvoice } from '../lib/api'
import type { InvoiceExtraction, LineItem, SavedInvoice } from '../types/invoice'
import './InvoiceCard.css'
import './Modal.css'

type InvoiceCardProps = {
  invoice: SavedInvoice
  onSaved: (invoice: SavedInvoice) => void
  onGeneratePdf: () => void
  onDelete: () => void
}

function toEditable(invoice: SavedInvoice): InvoiceExtraction {
  return {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    issuer: { ...invoice.issuer },
    receiver: { ...invoice.receiver },
    subtotal_amount: invoice.subtotal_amount,
    tax_amount: invoice.tax_amount,
    total_amount: invoice.total_amount,
    currency: invoice.currency,
    line_items: invoice.line_items.map(({ description, category, quantity, unit_price, amount }) => ({
      description,
      category,
      quantity,
      unit_price,
      amount,
    })),
  }
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function draftsEqual(left: InvoiceExtraction, right: InvoiceExtraction): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

type FieldInputProps = {
  value: string | number | null
  inputType?: 'text' | 'number'
  step?: string
  className?: string
  ariaLabel: string
  onChange: (raw: string) => void
}

function FieldInput({
  value,
  inputType = 'text',
  step,
  className,
  ariaLabel,
  onChange,
}: FieldInputProps) {
  return (
    <input
      type={inputType}
      step={step}
      className={`invoice-card__input ${className ?? ''}`}
      value={value === null || value === undefined ? '' : String(value)}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  )
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.5 4.1 10 8.6l4.5-4.5 1.4 1.4L11.4 10l4.5 4.5-1.4 1.4L10 11.4l-4.5 4.5-1.4-1.4L8.6 10 4.1 5.5l1.4-1.4z"
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

export function InvoiceCard({ invoice, onSaved, onGeneratePdf, onDelete }: InvoiceCardProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [draft, setDraft] = useState<InvoiceExtraction>(() => toEditable(invoice))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedDraft = toEditable(invoice)
  const isDirty = !draftsEqual(draft, savedDraft)

  useEffect(() => {
    setDraft(toEditable(invoice))
    setError(null)
    setIsSaving(false)
    setIsEditMode(false)
  }, [invoice])

  const updateLineItem = (index: number, field: keyof LineItem, raw: string) => {
    setDraft((current) => {
      const lineItems = [...current.line_items]
      const item = { ...lineItems[index] }

      if (field === 'description' || field === 'category') {
        item[field] = parseOptionalString(raw)
      } else {
        item[field] = parseOptionalNumber(raw)
      }

      lineItems[index] = item
      return { ...current, line_items: lineItems }
    })
  }

  const handleToggleEdit = () => {
    if (isEditMode) {
      if (isDirty) {
        return
      }
      setIsEditMode(false)
      return
    }

    setDraft(toEditable(invoice))
    setError(null)
    setIsEditMode(true)
  }

  const handleDiscard = () => {
    setDraft(toEditable(invoice))
    setError(null)
    setIsEditMode(false)
  }

  const handleSubmit = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateInvoice(invoice.id, draft)
      onSaved(updated)
      setIsEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice')
      setIsSaving(false)
    }
  }

  const showSubtotal = draft.subtotal_amount != null || invoice.subtotal_amount != null || isEditMode
  const showTax = draft.tax_amount != null || invoice.tax_amount != null || isEditMode

  return (
    <article
      className={`invoice-card${isEditMode ? ' invoice-card--editing' : ''}${isDirty ? ' invoice-card--dirty' : ''}`}
    >
      <div className="invoice-card__body">
        <div className="invoice-card__pdf-wrap">
          <iframe
            src={getInvoicePdfUrl(invoice.id)}
            title={`Invoice ${displayValue(invoice.invoice_number)}`}
            className="invoice-card__pdf"
            loading="lazy"
          />
        </div>

        <div className="invoice-card__content">
          <div className="invoice-card__top">
            <div className="invoice-card__title">
              {isEditMode ? (
                <>
                  <FieldInput
                    className="invoice-card__number"
                    value={draft.invoice_number}
                    ariaLabel="invoice number"
                    onChange={(raw) => setDraft({ ...draft, invoice_number: parseOptionalString(raw) })}
                  />
                  <FieldInput
                    className="invoice-card__date"
                    value={draft.invoice_date}
                    ariaLabel="invoice date"
                    onChange={(raw) => setDraft({ ...draft, invoice_date: parseOptionalString(raw) })}
                  />
                </>
              ) : (
                <>
                  <span className="invoice-card__number">{displayValue(invoice.invoice_number)}</span>
                  <span className="invoice-card__date">{displayValue(invoice.invoice_date)}</span>
                </>
              )}
            </div>
            <div className="invoice-card__amounts">
              {isEditMode ? (
                <>
                  <FieldInput
                    className="invoice-card__total"
                    value={draft.total_amount}
                    inputType="number"
                    step="0.01"
                    ariaLabel="total amount"
                    onChange={(raw) => setDraft({ ...draft, total_amount: parseOptionalNumber(raw) })}
                  />
                  {showSubtotal && (
                    <FieldInput
                      className="invoice-card__subtotal"
                      value={draft.subtotal_amount}
                      inputType="number"
                      step="0.01"
                      ariaLabel="subtotal amount"
                      onChange={(raw) => setDraft({ ...draft, subtotal_amount: parseOptionalNumber(raw) })}
                    />
                  )}
                  {showTax && (
                    <FieldInput
                      className="invoice-card__subtotal"
                      value={draft.tax_amount}
                      inputType="number"
                      step="0.01"
                      ariaLabel="tax amount"
                      onChange={(raw) => setDraft({ ...draft, tax_amount: parseOptionalNumber(raw) })}
                    />
                  )}
                </>
              ) : (
                <>
                  <strong className="invoice-card__total">
                    {formatMoney(invoice.total_amount, invoice.currency)}
                  </strong>
                  {invoice.subtotal_amount != null && (
                    <span className="invoice-card__subtotal">
                      Subtotal {formatMoney(invoice.subtotal_amount, invoice.currency)}
                    </span>
                  )}
                  {invoice.tax_amount != null && (
                    <span className="invoice-card__subtotal">
                      Tax {formatMoney(invoice.tax_amount, invoice.currency)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <p className="invoice-card__parties">
            {isEditMode ? (
              <>
                <FieldInput
                  value={draft.issuer.name}
                  ariaLabel="issuer name"
                  onChange={(raw) =>
                    setDraft({
                      ...draft,
                      issuer: { ...draft.issuer, name: parseOptionalString(raw) },
                    })
                  }
                />
                <span className="invoice-card__arrow">→</span>
                <FieldInput
                  value={draft.receiver.name}
                  ariaLabel="receiver name"
                  onChange={(raw) =>
                    setDraft({
                      ...draft,
                      receiver: { ...draft.receiver, name: parseOptionalString(raw) },
                    })
                  }
                />
              </>
            ) : (
              <>
                <span>{displayValue(invoice.issuer.name)}</span>
                <span className="invoice-card__arrow">→</span>
                <span>{displayValue(invoice.receiver.name)}</span>
              </>
            )}
          </p>

          {(isEditMode ? draft.line_items : invoice.line_items).length > 0 && (
            <div className="invoice-card__items">
              <div className="invoice-card__items-head" aria-hidden="true">
                <span>Item</span>
                <span>Category</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Total</span>
              </div>
              <ul className="invoice-card__items-list">
                {(isEditMode ? draft.line_items : invoice.line_items).map((item, index) => (
                  <li key={invoice.line_items[index]?.id ?? index} className="invoice-card__item">
                    {isEditMode ? (
                      <>
                        <FieldInput
                          className="invoice-card__item-desc"
                          value={item.description}
                          ariaLabel={`line item ${index + 1} description`}
                          onChange={(raw) => updateLineItem(index, 'description', raw)}
                        />
                        <FieldInput
                          className="invoice-card__item-category"
                          value={item.category}
                          ariaLabel={`line item ${index + 1} category`}
                          onChange={(raw) => updateLineItem(index, 'category', raw)}
                        />
                        <FieldInput
                          value={item.quantity}
                          inputType="number"
                          step="any"
                          ariaLabel={`line item ${index + 1} quantity`}
                          onChange={(raw) => updateLineItem(index, 'quantity', raw)}
                        />
                        <FieldInput
                          value={item.unit_price}
                          inputType="number"
                          step="0.01"
                          ariaLabel={`line item ${index + 1} unit price`}
                          onChange={(raw) => updateLineItem(index, 'unit_price', raw)}
                        />
                        <FieldInput
                          value={item.amount}
                          inputType="number"
                          step="0.01"
                          ariaLabel={`line item ${index + 1} total`}
                          onChange={(raw) => updateLineItem(index, 'amount', raw)}
                        />
                      </>
                    ) : (
                      <>
                        <span className="invoice-card__item-desc">{displayValue(item.description)}</span>
                        <span className="invoice-card__item-category">{displayValue(item.category)}</span>
                        <span>{formatNumber(item.quantity)}</span>
                        <span>{formatNumber(item.unit_price)}</span>
                        <span>{formatNumber(item.amount)}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {isEditMode && isDirty && (
        <div className="invoice-card__edit-actions">
          {error && <p className="invoice-card__edit-error">{error}</p>}
          <div className="invoice-card__edit-buttons">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={handleDiscard}
              disabled={isSaving}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={() => void handleSubmit()}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      <div className="invoice-card__actions">
        <button
          type="button"
          className={`invoice-card__action invoice-card__action--edit${isEditMode ? ' invoice-card__action--active' : ''}`}
          onClick={handleToggleEdit}
          aria-label={isEditMode ? 'Close edit mode' : 'Edit invoice'}
          aria-pressed={isEditMode}
          title={isEditMode ? 'Close edit' : 'Edit'}
        >
          {isEditMode ? <CloseIcon /> : <EditIcon />}
        </button>
        <button
          type="button"
          className="invoice-card__action invoice-card__action--pdf"
          onClick={onGeneratePdf}
          aria-label="Generate expense report PDF"
          title="Generate PDF"
        >
          <PdfIcon />
        </button>
        <button
          type="button"
          className="invoice-card__action invoice-card__action--delete"
          onClick={onDelete}
          aria-label="Delete invoice"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </article>
  )
}
