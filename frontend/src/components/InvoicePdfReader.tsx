import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getInvoicePdfUrl } from '../lib/api'
import './InvoicePdfReader.css'

type InvoicePdfReaderProps = {
  invoiceId: number
  title: string
  isOpen: boolean
  onClose: () => void
}

export function InvoicePdfReader({ invoiceId, title, isOpen, onClose }: InvoicePdfReaderProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className="invoice-pdf-reader" onClick={onClose} role="presentation">
      <div className="invoice-pdf-reader__panel" onClick={(event) => event.stopPropagation()}>
        <iframe
          className="invoice-pdf-reader__frame"
          src={getInvoicePdfUrl(invoiceId)}
          title={title}
        />
      </div>
    </div>,
    document.body,
  )
}
