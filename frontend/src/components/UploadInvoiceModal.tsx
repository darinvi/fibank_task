import { useEffect, useId, useRef, useState } from 'react'
import { extractInvoice } from '../lib/api'
import { isPdfFile, PDF_FILE_ACCEPT } from '../lib/pdfFile'
import type { SavedInvoice } from '../types/invoice'
import './Modal.css'
import './UploadInvoiceModal.css'

type UploadInvoiceModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (invoice: SavedInvoice) => void
}

export function UploadInvoiceModal({ isOpen, onClose, onSuccess }: UploadInvoiceModalProps) {
  const titleId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setIsSubmitting(false)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  useEffect(() => {
    if (!isOpen) {
      reset()
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting])

  const handleFileSelect = (selectedFile: File) => {
    if (!isPdfFile(selectedFile)) {
      setError('Please choose a PDF file.')
      return
    }

    setError(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const savedInvoice = await extractInvoice(file, file.name)
      onSuccess?.(savedInvoice)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process invoice')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" onClick={isSubmitting ? undefined : handleClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>Upload invoice</h2>
          <button
            type="button"
            className="modal__close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="modal__body">
          {!file ? (
            <div
              className="upload-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <p>Select or drop an invoice PDF to begin.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                Choose PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={PDF_FILE_ACCEPT}
                hidden
                onChange={handleInputChange}
              />
            </div>
          ) : (
            <div className="upload-preview">
              <p className="upload-preview__filename">{file.name}</p>
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  title={`Preview of ${file.name}`}
                  className="upload-preview__pdf"
                />
              )}
            </div>
          )}

          {error && <p className="modal__error">{error}</p>}
        </div>

        {file && (
          <footer className="modal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={reset}
              disabled={isSubmitting}
            >
              Choose another
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing…' : 'Process invoice'}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
