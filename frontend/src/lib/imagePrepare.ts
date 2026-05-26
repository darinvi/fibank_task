export type ImageTransform = {
  zoom: number
  panX: number
  panY: number
  rotation: number
}

export const VIEWPORT_WIDTH = 480
export const VIEWPORT_HEIGHT = 360

export function getBaseScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): number {
  return Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight)
}

export function getMaxPan(
  imageWidth: number,
  imageHeight: number,
  transform: ImageTransform,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): { x: number; y: number } {
  const baseScale = getBaseScale(imageWidth, imageHeight, viewportWidth, viewportHeight)
  const scaledWidth = imageWidth * baseScale * transform.zoom
  const scaledHeight = imageHeight * baseScale * transform.zoom
  const radians = (transform.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const rotatedWidth = scaledWidth * cos + scaledHeight * sin
  const rotatedHeight = scaledWidth * sin + scaledHeight * cos

  return {
    x: Math.max(0, (rotatedWidth - viewportWidth) / 2),
    y: Math.max(0, (rotatedHeight - viewportHeight) / 2),
  }
}

export function clampPan(
  imageWidth: number,
  imageHeight: number,
  transform: ImageTransform,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): ImageTransform {
  const maxPan = getMaxPan(imageWidth, imageHeight, transform, viewportWidth, viewportHeight)

  return {
    ...transform,
    panX: Math.min(maxPan.x, Math.max(-maxPan.x, transform.panX)),
    panY: Math.min(maxPan.y, Math.max(-maxPan.y, transform.panY)),
  }
}

export type CropEdgeOverflow = {
  top: number
  right: number
  bottom: number
  left: number
}

export function getCropEdgeOverflow(
  imageWidth: number,
  imageHeight: number,
  transform: ImageTransform,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): CropEdgeOverflow {
  const baseScale = getBaseScale(imageWidth, imageHeight, viewportWidth, viewportHeight)
  const scale = baseScale * transform.zoom
  const radians = (transform.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const centerX = viewportWidth / 2 + transform.panX
  const centerY = viewportHeight / 2 + transform.panY

  const halfWidth = (imageWidth * scale) / 2
  const halfHeight = (imageHeight * scale) / 2

  const corners = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ].map(([x, y]) => ({
    x: centerX + x * cos - y * sin,
    y: centerY + x * sin + y * cos,
  }))

  const minX = Math.min(...corners.map((point) => point.x))
  const maxX = Math.max(...corners.map((point) => point.x))
  const minY = Math.min(...corners.map((point) => point.y))
  const maxY = Math.max(...corners.map((point) => point.y))

  return {
    top: Math.max(0, -minY),
    right: Math.max(0, maxX - viewportWidth),
    bottom: Math.max(0, maxY - viewportHeight),
    left: Math.max(0, -minX),
  }
}

export function cropCanvasToInnerArea(
  canvas: HTMLCanvasElement,
  overflow: CropEdgeOverflow,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): HTMLCanvasElement {
  const sourceWidth = canvas.width
  const sourceHeight = canvas.height
  const scaleX = sourceWidth / viewportWidth
  const scaleY = sourceHeight / viewportHeight

  const cropX = overflow.left * scaleX
  const cropY = overflow.top * scaleY
  const cropW = sourceWidth - (overflow.left + overflow.right) * scaleX
  const cropH = sourceHeight - (overflow.top + overflow.bottom) * scaleY

  if (cropW >= sourceWidth - 0.5 && cropH >= sourceHeight - 0.5) {
    return canvas
  }

  const safeW = Math.max(1, Math.round(cropW))
  const safeH = Math.max(1, Math.round(cropH))

  const cropped = document.createElement('canvas')
  cropped.width = safeW
  cropped.height = safeH

  const ctx = cropped.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create canvas context')
  }

  ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, safeW, safeH)
  return cropped
}

export function drawPreparedImage(
  image: HTMLImageElement,
  transform: ImageTransform,
  targetCanvas?: HTMLCanvasElement | null,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): HTMLCanvasElement {
  const canvas = targetCanvas ?? document.createElement('canvas')
  canvas.width = viewportWidth
  canvas.height = viewportHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create canvas context')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  const { width: imageWidth, height: imageHeight } = getImageDimensions(image)
  const baseScale = getBaseScale(imageWidth, imageHeight, viewportWidth, viewportHeight)
  const scale = baseScale * transform.zoom

  ctx.save()
  ctx.translate(viewportWidth / 2 + transform.panX, viewportHeight / 2 + transform.panY)
  ctx.rotate((transform.rotation * Math.PI) / 180)
  ctx.scale(scale, scale)
  ctx.drawImage(image, -imageWidth / 2, -imageHeight / 2)
  ctx.restore()

  return canvas
}

export function getImageDimensions(image: HTMLImageElement): { width: number; height: number } {
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to prepare image'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.92,
    )
  })
}

export async function renderPreparedImageBlob(
  image: HTMLImageElement,
  transform: ImageTransform,
): Promise<Blob> {
  const { width, height } = getImageDimensions(image)
  const clamped = clampPan(width, height, transform)
  const canvas = drawPreparedImage(image, clamped)
  const overflow = getCropEdgeOverflow(width, height, clamped)
  const cropped = cropCanvasToInnerArea(canvas, overflow)
  return canvasToBlob(cropped)
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

async function normalizeImageOrientation(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  if (typeof createImageBitmap !== 'function') {
    const objectUrl = URL.createObjectURL(file)
    try {
      return { image: await loadImageElement(objectUrl), objectUrl }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const objectUrl = URL.createObjectURL(file)
    try {
      return { image: await loadImageElement(objectUrl), objectUrl }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not create canvas context')
  }

  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Failed to normalize image'))
          return
        }
        resolve(result)
      },
      'image/jpeg',
      0.92,
    )
  })

  const objectUrl = URL.createObjectURL(blob)
  try {
    return { image: await loadImageElement(objectUrl), objectUrl }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

export async function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return normalizeImageOrientation(file)
}
