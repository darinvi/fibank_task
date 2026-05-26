import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { extractInvoice } from '../lib/api'
import { fetchExamplePdf, getExamplePdfUrl, loadExamplePdfFilenames } from '../lib/examplePdfs'
import { renderPdfPreview } from '../lib/pdfPreview'
import { isPdfFile, PDF_FILE_ACCEPT } from '../lib/pdfFile'
import type { SavedInvoice } from '../types/invoice'
import './Modal.css'
import './UploadInvoiceModal.css'

type UploadInvoiceModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (invoice: SavedInvoice) => void
  onSubmittingChange?: (isSubmitting: boolean) => void
}

type ExamplePdfCardProps = {
  filename: string
  isLoading: boolean
  disabled: boolean
  onSelect: (filename: string) => void
}

function ExamplePdfCard({ filename, isLoading, disabled, onSelect }: ExamplePdfCardProps) {
  const previewRef = useRef<HTMLSpanElement>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const container = previewRef.current
    if (!container) {
      return
    }

    let cancelled = false
    const width = container.clientWidth

    void renderPdfPreview(getExamplePdfUrl(filename), container, width).catch(() => {
      if (!cancelled) {
        container.replaceChildren()
      }
    })

    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [filename])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    suppressClickRef.current = false
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerStart = pointerStartRef.current
    if (!pointerStart) {
      return
    }

    const deltaX = event.clientX - pointerStart.x
    const deltaY = event.clientY - pointerStart.y
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      suppressClickRef.current = true
    }
  }

  const handlePointerUp = () => {
    pointerStartRef.current = null
  }

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    onSelect(filename)
  }

  return (
    <button
      type="button"
      className="sample-pdf-card"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      disabled={disabled}
      aria-busy={isLoading}
      aria-label={`Use sample ${filename}`}
      title={filename}
    >
      <span ref={previewRef} className="sample-pdf-card__preview" />
      <span className="sample-pdf-card__name">{isLoading ? 'Loading…' : filename}</span>
    </button>
  )
}

export function UploadInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  onSubmittingChange,
}: UploadInvoiceModalProps) {
  const titleId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exampleScrollRef = useRef<HTMLDivElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [examplePdfFilenames, setExamplePdfFilenames] = useState<string[]>([])
  const [loadingExamplePdf, setLoadingExamplePdf] = useState<string | null>(null)

  const resetForm = () => {
    setFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const resetAll = () => {
    resetForm()
    setIsSubmitting(false)
  }

  const handleClose = () => {
    if (isSubmitting) {
      onClose()
      return
    }

    resetAll()
    onClose()
  }

  useEffect(() => {
    if (!isOpen && !isSubmitting) {
      resetForm()
    }
  }, [isOpen, isSubmitting])

  useEffect(() => {
    onSubmittingChange?.(isSubmitting)
  }, [isSubmitting, onSubmittingChange])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let cancelled = false

    void loadExamplePdfFilenames().then((filenames) => {
      if (!cancelled) {
        setExamplePdfFilenames(filenames)
      }
    })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  useEffect(() => {
    const scrollElement = exampleScrollRef.current
    if (!isOpen || !scrollElement) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return
      }

      const target = event.target
      if (target instanceof Element && target.closest('.sample-pdf-card__preview')) {
        return
      }

      event.preventDefault()
      scrollElement.scrollLeft += event.deltaY
    }

    scrollElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => scrollElement.removeEventListener('wheel', handleWheel)
  }, [isOpen, examplePdfFilenames])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
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

  const handleExamplePdfSelect = async (filename: string) => {
    setLoadingExamplePdf(filename)
    setError(null)

    try {
      const exampleFile = await fetchExamplePdf(filename)
      handleFileSelect(exampleFile)
    } catch {
      setError(`Could not load ${filename}.`)
    } finally {
      setLoadingExamplePdf(null)
    }
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
      resetAll()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process invoice')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
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
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="modal__body">
          {!file ? (
            <>
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
                  disabled={isSubmitting || loadingExamplePdf !== null}
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

              {examplePdfFilenames.length > 0 && (
                <section className="samples" aria-label="Sample invoices">
                  <p className="samples__label">Or try a sample</p>
                  <div ref={exampleScrollRef} className="samples__scroll">
                    {examplePdfFilenames.map((filename) => (
                      <ExamplePdfCard
                        key={filename}
                        filename={filename}
                        isLoading={loadingExamplePdf === filename}
                        disabled={isSubmitting || loadingExamplePdf !== null}
                        onSelect={(name) => void handleExamplePdfSelect(name)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="upload-preview">
              <p className="upload-preview__filename">{file.name}</p>
              {previewUrl && (
                <div
                  className={`upload-preview__pdf-wrap${
                    isSubmitting ? ' upload-preview__pdf-wrap--loading' : ''
                  }`}
                >
                  <iframe
                    src={previewUrl}
                    title={`Preview of ${file.name}`}
                    className="upload-preview__pdf"
                  />
                  {isSubmitting && (
                    <div className="upload-preview__spinner" aria-hidden="true">
                      <span className="spinner upload-preview__spinner-icon" />
                    </div>
                  )}
                </div>
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
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Choose another
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <span className="spinner" aria-hidden="true" />}
              {isSubmitting ? 'Processing…' : 'Process invoice'}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
