import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { canvasToBlob, loadImageElement } from './imagePrepare'

let workerReady: Promise<void> | null = null

function ensurePdfWorker(): Promise<void> {
  if (!workerReady) {
    workerReady = Promise.resolve().then(() => {
      GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.js`
    })
  }
  return workerReady
}

export async function loadPdfFromFile(
  file: File,
): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  await ensurePdfWorker()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise

  if (pdf.numPages < 1) {
    throw new Error('PDF has no pages')
  }

  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not create canvas context')
  }

  await page.render({ canvasContext: ctx, viewport, canvas }).promise

  const blob = await canvasToBlob(canvas)
  const objectUrl = URL.createObjectURL(blob)
  try {
    return { image: await loadImageElement(objectUrl), objectUrl }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}
