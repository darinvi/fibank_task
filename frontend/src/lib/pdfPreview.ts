import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

export async function renderPdfThumbnail(
  url: string,
  container: HTMLElement,
  width: number,
): Promise<void> {
  const pdf = await pdfjsLib.getDocument(url).promise
  const page = await pdf.getPage(1)
  const scale = width / page.getViewport({ scale: 1 }).width
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  container.replaceChildren()

  if (!context) {
    return
  }

  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.className = 'invoice-card__pdf-page'

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise

  container.appendChild(canvas)
}

export async function renderPdfPreview(
  url: string,
  container: HTMLElement,
  width: number,
): Promise<void> {
  const pdf = await pdfjsLib.getDocument(url).promise

  container.replaceChildren()

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const scale = width / page.getViewport({ scale: 1 }).width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      continue
    }

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.className = 'sample-pdf-card__page'

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise

    container.appendChild(canvas)
  }
}
