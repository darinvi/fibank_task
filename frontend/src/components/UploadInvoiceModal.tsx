import { useEffect, useId, useRef, useState } from 'react'
import { extractInvoice } from '../lib/api'
import type { SavedInvoice } from '../types/invoice'
import {
  loadImageFromFile,
  renderPreparedImageBlob,
  type ImageTransform,
} from '../lib/imagePrepare'
import { DEFAULT_TRANSFORM, ImageEditor, type ImageEditorHandle } from './ImageEditor'
import './Modal.css'
import './UploadInvoiceModal.css'

type UploadInvoiceModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (invoice: SavedInvoice) => void
}

type Step = 'pick' | 'edit'

export function UploadInvoiceModal({ isOpen, onClose, onSuccess }: UploadInvoiceModalProps) {
  const titleId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<ImageEditorHandle>(null)
  const [step, setStep] = useState<Step>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [transform, setTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep('pick')
    setFile(null)
    setImage(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setTransform(DEFAULT_TRANSFORM)
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

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }

    setError(null)

    try {
      const { image: loadedImage, objectUrl } = await loadImageFromFile(selectedFile)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setFile(selectedFile)
      setImage(loadedImage)
      setPreviewUrl(objectUrl)
      setTransform(DEFAULT_TRANSFORM)
      setStep('edit')
    } catch {
      setError('Could not load the selected image.')
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      void handleFileSelect(selectedFile)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      void handleFileSelect(droppedFile)
    }
  }

  const handleSubmit = async () => {
    if (!image || !file) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const preparedBlob = editorRef.current
        ? await editorRef.current.exportBlob()
        : await renderPreparedImageBlob(image, transform)
      const preparedFile = new File(
        [preparedBlob],
        file.name.replace(/\.[^.]+$/, '.jpg'),
        { type: 'image/jpeg' },
      )
      const savedInvoice = await extractInvoice(preparedFile, preparedFile.name)
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
          {step === 'pick' && (
            <div
              className="upload-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <p>Select or drop an invoice photo to begin.</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleInputChange}
              />
            </div>
          )}

          {step === 'edit' && image && previewUrl && (
            <ImageEditor
              ref={editorRef}
              image={image}
              transform={transform}
              onTransformChange={setTransform}
            />
          )}

          {error && <p className="modal__error">{error}</p>}
        </div>

        {step === 'edit' && (
          <footer className="modal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setStep('pick')
                setFile(null)
                setImage(null)
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl)
                }
                setPreviewUrl(null)
                setTransform(DEFAULT_TRANSFORM)
                setError(null)
              }}
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
