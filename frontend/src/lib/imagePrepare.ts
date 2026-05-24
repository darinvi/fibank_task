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

export function drawPreparedImage(
  image: HTMLImageElement,
  transform: ImageTransform,
  viewportWidth = VIEWPORT_WIDTH,
  viewportHeight = VIEWPORT_HEIGHT,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = viewportWidth
  canvas.height = viewportHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create canvas context')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, viewportWidth, viewportHeight)

  const baseScale = getBaseScale(image.width, image.height, viewportWidth, viewportHeight)
  const scale = baseScale * transform.zoom

  ctx.save()
  ctx.translate(viewportWidth / 2 + transform.panX, viewportHeight / 2 + transform.panY)
  ctx.rotate((transform.rotation * Math.PI) / 180)
  ctx.scale(scale, scale)
  ctx.drawImage(image, -image.width / 2, -image.height / 2)
  ctx.restore()

  return canvas
}

export async function renderPreparedImageBlob(
  image: HTMLImageElement,
  transform: ImageTransform,
): Promise<Blob> {
  const canvas = drawPreparedImage(image, transform)

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

export async function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = objectUrl
    })

    return { image, objectUrl }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}
