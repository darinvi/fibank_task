import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampPan,
  getBaseScale,
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

      {transform.zoom > 1 && (
        <p className="image-editor__hint">Drag the image to choose what stays in view.</p>
      )}
    </div>
  )
}

export const EDITOR_VIEWPORT = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
