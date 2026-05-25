import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampPan,
  getBaseScale,
  getCropEdgeOverflow,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  type ImageTransform,
} from '../lib/imagePrepare'
import './ImageEditor.css'

type ImageEditorProps = {
  image: HTMLImageElement
  previewUrl: string
  transform: ImageTransform
  onTransformChange: (transform: ImageTransform) => void
}

const DEFAULT_TRANSFORM: ImageTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
  rotation: 0,
}

export { DEFAULT_TRANSFORM }

export function ImageEditor({ image, previewUrl, transform, onTransformChange }: ImageEditorProps) {
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  )
  const [isDragging, setIsDragging] = useState(false)

  const baseScale = getBaseScale(image.width, image.height)
  const scale = baseScale * transform.zoom
  const cropOverflow = getCropEdgeOverflow(image.width, image.height, transform)
  const hasExcludedContent =
    cropOverflow.top > 0 ||
    cropOverflow.right > 0 ||
    cropOverflow.bottom > 0 ||
    cropOverflow.left > 0

  const updateTransform = useCallback(
    (next: ImageTransform) => {
      onTransformChange(clampPan(image.width, image.height, next))
    },
    [image.height, image.width, onTransformChange],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (transform.zoom <= 1) {
      return
    }

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: transform.panX,
      panY: transform.panY,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return
    }

    const deltaX = event.clientX - dragRef.current.startX
    const deltaY = event.clientY - dragRef.current.startY

    updateTransform({
      ...transform,
      panX: dragRef.current.panX + deltaX,
      panY: dragRef.current.panY + deltaY,
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  useEffect(() => {
    onTransformChange(clampPan(image.width, image.height, transform))
  }, [image.height, image.width, onTransformChange, transform.rotation, transform.zoom])

  return (
    <div className="image-editor">
      <div className="image-editor__crop-area">
        <div
          className={`image-editor__viewport${isDragging ? ' image-editor__viewport--dragging' : ''}${transform.zoom > 1 ? ' image-editor__viewport--pannable' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            src={previewUrl}
            alt="Invoice preview"
            className="image-editor__image"
            draggable={false}
            style={{
              width: `${image.width * scale}px`,
              height: `${image.height * scale}px`,
              transform: `translate(${transform.panX}px, ${transform.panY}px) rotate(${transform.rotation}deg)`,
            }}
          />
        </div>

        {hasExcludedContent && (
          <div className="image-editor__excluded" aria-hidden="true">
            {cropOverflow.top > 0 && (
              <div
                className="image-editor__excluded-edge image-editor__excluded-edge--top"
                style={{ height: `${(cropOverflow.top / VIEWPORT_HEIGHT) * 100}%` }}
              />
            )}
            {cropOverflow.right > 0 && (
              <div
                className="image-editor__excluded-edge image-editor__excluded-edge--right"
                style={{ width: `${(cropOverflow.right / VIEWPORT_WIDTH) * 100}%` }}
              />
            )}
            {cropOverflow.bottom > 0 && (
              <div
                className="image-editor__excluded-edge image-editor__excluded-edge--bottom"
                style={{ height: `${(cropOverflow.bottom / VIEWPORT_HEIGHT) * 100}%` }}
              />
            )}
            {cropOverflow.left > 0 && (
              <div
                className="image-editor__excluded-edge image-editor__excluded-edge--left"
                style={{ width: `${(cropOverflow.left / VIEWPORT_WIDTH) * 100}%` }}
              />
            )}
          </div>
        )}

        <div className="image-editor__crop-frame" aria-hidden="true">
          <span className="image-editor__crop-label">Sent to LLM</span>
        </div>
      </div>

      <div className="image-editor__controls">
        <label className="image-editor__control">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={transform.zoom}
            onChange={(event) =>
              updateTransform({ ...transform, zoom: Number(event.target.value) })
            }
          />
          <span className="image-editor__value">{Math.round(transform.zoom * 100)}%</span>
        </label>

        <label className="image-editor__control">
          <span>Rotation</span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={transform.rotation}
            onChange={(event) =>
              updateTransform({ ...transform, rotation: Number(event.target.value) })
            }
          />
          <span className="image-editor__value">{transform.rotation}°</span>
        </label>
      </div>

      {(transform.zoom > 1 || transform.rotation !== 0) && (
        <p className="image-editor__hint">
          Green outline = area sent to the LLM. Red edges = cropped away.
        </p>
      )}
    </div>
  )
}

export const EDITOR_VIEWPORT = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
