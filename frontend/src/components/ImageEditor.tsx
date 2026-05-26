import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  canvasToBlob,
  clampPan,
  cropCanvasToInnerArea,
  drawPreparedImage,
  getCropEdgeOverflow,
  getImageDimensions,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  type ImageTransform,
} from '../lib/imagePrepare'
import './ImageEditor.css'

type ImageEditorProps = {
  image: HTMLImageElement
  transform: ImageTransform
  onTransformChange: (transform: ImageTransform) => void
}

export type ImageEditorHandle = {
  exportBlob: () => Promise<Blob>
}

const DEFAULT_TRANSFORM: ImageTransform = {
  zoom: 1,
  panX: 0,
  panY: 0,
  rotation: 0,
}

export { DEFAULT_TRANSFORM }

function getPointerScale(canvas: HTMLCanvasElement | null): number {
  if (!canvas) {
    return 1
  }

  const { width } = canvas.getBoundingClientRect()
  if (width <= 0) {
    return 1
  }

  return VIEWPORT_WIDTH / width
}

export const ImageEditor = forwardRef<ImageEditorHandle, ImageEditorProps>(function ImageEditor(
  { image, transform, onTransformChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerScaleRef = useRef(1)
  const transformRef = useRef(transform)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  )
  const [isDragging, setIsDragging] = useState(false)

  transformRef.current = transform

  const imageDimensions = getImageDimensions(image)
  const clampedTransform = clampPan(
    imageDimensions.width,
    imageDimensions.height,
    transform,
  )
  const cropOverflow = getCropEdgeOverflow(
    imageDimensions.width,
    imageDimensions.height,
    clampedTransform,
  )
  const hasExcludedContent =
    cropOverflow.top > 0 ||
    cropOverflow.right > 0 ||
    cropOverflow.bottom > 0 ||
    cropOverflow.left > 0

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    pointerScaleRef.current = getPointerScale(canvas)
    const current = clampPan(
      imageDimensions.width,
      imageDimensions.height,
      transformRef.current,
    )
    drawPreparedImage(image, current, canvas)
  }, [image, imageDimensions.height, imageDimensions.width])

  const updateTransform = useCallback(
    (next: ImageTransform) => {
      onTransformChange(
        clampPan(imageDimensions.width, imageDimensions.height, next),
      )
    },
    [imageDimensions.height, imageDimensions.width, onTransformChange],
  )

  useImperativeHandle(
    ref,
    () => ({
      exportBlob: async () => {
        const canvas = canvasRef.current
        if (!canvas) {
          throw new Error('Editor preview is not ready')
        }

        const current = clampPan(
          imageDimensions.width,
          imageDimensions.height,
          transformRef.current,
        )
        drawPreparedImage(image, current, canvas)
        const overflow = getCropEdgeOverflow(
          imageDimensions.width,
          imageDimensions.height,
          current,
        )
        const cropped = cropCanvasToInnerArea(canvas, overflow)
        return canvasToBlob(cropped)
      },
    }),
    [image, imageDimensions.height, imageDimensions.width],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (transformRef.current.zoom <= 1) {
      return
    }

    pointerScaleRef.current = getPointerScale(canvasRef.current)

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: transformRef.current.panX,
      panY: transformRef.current.panY,
    }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return
    }

    const scale = pointerScaleRef.current
    const deltaX = (event.clientX - dragRef.current.startX) * scale
    const deltaY = (event.clientY - dragRef.current.startY) * scale
    const current = transformRef.current

    updateTransform({
      ...current,
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
    renderPreview()
  }, [renderPreview, transform])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const syncPointerScale = () => {
      pointerScaleRef.current = getPointerScale(canvas)
    }

    syncPointerScale()
    const observer = new ResizeObserver(syncPointerScale)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

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
          <canvas
            ref={canvasRef}
            className="image-editor__canvas"
            width={VIEWPORT_WIDTH}
            height={VIEWPORT_HEIGHT}
            aria-label="Invoice preview"
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

        <div
          className="image-editor__crop-frame"
          aria-hidden="true"
          style={{
            top: `${(cropOverflow.top / VIEWPORT_HEIGHT) * 100}%`,
            right: `${(cropOverflow.right / VIEWPORT_WIDTH) * 100}%`,
            bottom: `${(cropOverflow.bottom / VIEWPORT_HEIGHT) * 100}%`,
            left: `${(cropOverflow.left / VIEWPORT_WIDTH) * 100}%`,
          }}
        >
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
            onChange={(event) => {
              const zoom = Number(event.target.value)
              updateTransform({ ...transformRef.current, zoom })
            }}
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
            onChange={(event) => {
              const rotation = Number(event.target.value)
              updateTransform({ ...transformRef.current, rotation })
            }}
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
})

export const EDITOR_VIEWPORT = { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
