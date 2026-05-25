import { useEffect, useId } from 'react'
import './ConfirmDialog.css'
import './Modal.css'

type ConfirmDialogProps = {
  isOpen: boolean
  title?: string
  message: string
  error?: string | null
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  title = 'Confirm',
  message,
  error = null,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const titleId = useId()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isLoading) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-backdrop confirm-dialog-backdrop" onClick={isLoading ? undefined : onCancel}>
      <div
        className="modal confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog__body">
          <h2 id={titleId}>{title}</h2>
          <p>{message}</p>
          {error && <p className="confirm-dialog__error">{error}</p>}
        </div>
        <footer className="modal__footer confirm-dialog__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Deleting…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
