import { useEffect, useId, useState } from 'react'
import { getInvoicePdfUrl, updateInvoice } from '../lib/api'
import type { InvoiceExtraction, LineItem, SavedInvoice } from '../types/invoice'
import './InvoiceDetailModal.css'
import './Modal.css'

type InvoiceDetailModalProps = {
  invoice: SavedInvoice | null
  isOpen: boolean
  onClose: () => void
  onSaved: (invoice: SavedInvoice) => void
}

const emptyLineItem = (): LineItem => ({
  description: null,
  category: null,
  quantity: null,
  unit_price: null,
  amount: null,
})

function toEditable(invoice: SavedInvoice): InvoiceExtraction {
  return {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    issuer: { ...invoice.issuer },
    receiver: { ...invoice.receiver },
    subtotal_amount: invoice.subtotal_amount,
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

export function InvoiceDetailModal({
  invoice,
  isOpen,
  onClose,
  onSaved,
}: InvoiceDetailModalProps) {
  const titleId = useId()
  const [draft, setDraft] = useState<InvoiceExtraction | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (invoice && isOpen) {
      setDraft(toEditable(invoice))
      setError(null)
      setIsSaving(false)
    }
  }, [invoice, isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isSaving) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  if (!isOpen || !invoice || !draft) {
    return null
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setDraft((current) => {
      if (!current) {
        return current
      }

      const lineItems = [...current.line_items]
      const item = { ...lineItems[index] }

      if (field === 'description' || field === 'category') {
        item[field] = parseOptionalString(value)
      } else {
        item[field] = parseOptionalNumber(value)
      }

      lineItems[index] = item
      return { ...current, line_items: lineItems }
    })
  }

  const addLineItem = () => {
    setDraft((current) =>
      current ? { ...current, line_items: [...current.line_items, emptyLineItem()] } : current,
    )
  }

  const removeLineItem = (index: number) => {
    setDraft((current) =>
      current
        ? { ...current, line_items: current.line_items.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const updated = await updateInvoice(invoice.id, draft)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice')
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={isSaving ? undefined : onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>Invoice #{invoice.id}</h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="modal__body invoice-detail">
          <div className="invoice-detail__pdf-panel">
            <iframe
              src={getInvoicePdfUrl(invoice.id)}
              title={`Invoice ${invoice.invoice_number ?? invoice.id}`}
              className="invoice-detail__pdf"
            />
          </div>

          <div className="invoice-detail__form">
            <section className="invoice-detail__section">
              <h3 className="invoice-detail__section-title">Invoice details</h3>
              <div className="invoice-detail__grid invoice-detail__grid--details">
              <label>
                Invoice number
                <input
                  type="text"
                  value={draft.invoice_number ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, invoice_number: parseOptionalString(event.target.value) })
                  }
                />
              </label>
              <label>
                Invoice date
                <input
                  type="text"
                  value={draft.invoice_date ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, invoice_date: parseOptionalString(event.target.value) })
                  }
                />
              </label>
              <label>
                Subtotal amount
                <input
                  type="number"
                  step="0.01"
                  value={draft.subtotal_amount ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, subtotal_amount: parseOptionalNumber(event.target.value) })
                  }
                />
              </label>
              <label>
                Total amount
                <input
                  type="number"
                  step="0.01"
                  value={draft.total_amount ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, total_amount: parseOptionalNumber(event.target.value) })
                  }
                />
              </label>
              <label>
                Currency
                <input
                  type="text"
                  maxLength={3}
                  value={draft.currency ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, currency: parseOptionalString(event.target.value) })
                  }
                />
              </label>
              </div>
            </section>

            <section className="invoice-detail__section invoice-detail__parties">
              <fieldset className="invoice-detail__party">
              <legend>Issuer</legend>
              <div className="invoice-detail__grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={draft.issuer.name ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        issuer: { ...draft.issuer, name: parseOptionalString(event.target.value) },
                      })
                    }
                  />
                </label>
                <label>
                  ID
                  <input
                    type="text"
                    value={draft.issuer.id ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        issuer: { ...draft.issuer, id: parseOptionalString(event.target.value) },
                      })
                    }
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="invoice-detail__party">
              <legend>Receiver</legend>
              <div className="invoice-detail__grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={draft.receiver.name ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        receiver: { ...draft.receiver, name: parseOptionalString(event.target.value) },
                      })
                    }
                  />
                </label>
                <label>
                  ID
                  <input
                    type="text"
                    value={draft.receiver.id ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        receiver: { ...draft.receiver, id: parseOptionalString(event.target.value) },
                      })
                    }
                  />
                </label>
              </div>
            </fieldset>
            </section>

            <section className="invoice-detail__section invoice-detail__items">
              <div className="invoice-detail__items-header">
                <h3>Line items</h3>
                <button type="button" className="btn btn--ghost btn--small" onClick={addLineItem}>
                  Add item
                </button>
              </div>

              {draft.line_items.length === 0 ? (
                <p className="invoice-detail__empty">No line items.</p>
              ) : (
                <div className="invoice-detail__items-list">
                  {draft.line_items.map((item, index) => (
                    <div className="invoice-detail__item-card" key={`line-item-${index}`}>
                      <div className="invoice-detail__item-header">
                        <span>Item {index + 1}</span>
                        <button
                          type="button"
                          className="invoice-detail__remove"
                          onClick={() => removeLineItem(index)}
                          aria-label="Remove line item"
                        >
                          Remove
                        </button>
                      </div>
                      <label>
                        Description
                        <input
                          type="text"
                          value={item.description ?? ''}
                          onChange={(event) => updateLineItem(index, 'description', event.target.value)}
                        />
                      </label>
                      <label>
                        Category
                        <input
                          type="text"
                          value={item.category ?? ''}
                          onChange={(event) => updateLineItem(index, 'category', event.target.value)}
                        />
                      </label>
                      <div className="invoice-detail__item-numbers">
                        <label>
                          Quantity
                          <input
                            type="number"
                            step="any"
                            value={item.quantity ?? ''}
                            onChange={(event) => updateLineItem(index, 'quantity', event.target.value)}
                          />
                        </label>
                        <label>
                          Unit price
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price ?? ''}
                            onChange={(event) => updateLineItem(index, 'unit_price', event.target.value)}
                          />
                        </label>
                        <label>
                          Amount
                          <input
                            type="number"
                            step="0.01"
                            value={item.amount ?? ''}
                            onChange={(event) => updateLineItem(index, 'amount', event.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {error && <p className="modal__error">{error}</p>}
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </div>
    </div>
  )
}
