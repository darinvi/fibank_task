import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLES_DIR = path.resolve(__dirname, '../samples')
const SAMPLES_BASE = '/samples'
const SAMPLES_INDEX_URL = `${SAMPLES_BASE}/index.json`
/** Allow slow OpenAI-backed invoice extract / ask requests through the dev proxy. */
const API_PROXY_TIMEOUT_MS = 3 * 60 * 1000

function listSamplePdfFilenames(): string[] {
  if (!fs.existsSync(SAMPLES_DIR)) {
    return []
  }

  return fs
    .readdirSync(SAMPLES_DIR)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b))
}

function resolveSamplePdfPath(filename: string): string | null {
  const safeName = path.basename(filename)
  if (!safeName.toLowerCase().endsWith('.pdf')) {
    return null
  }

  const filePath = path.join(SAMPLES_DIR, safeName)
  if (!filePath.startsWith(SAMPLES_DIR) || !fs.existsSync(filePath)) {
    return null
  }

  return filePath
}

function samplesPlugin(): Plugin {
  let outDir = path.resolve(__dirname, 'dist')

  return {
    name: 'samples-pdfs',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = req.url?.split('?')[0]
        if (!requestPath?.startsWith(SAMPLES_BASE)) {
          next()
          return
        }

        if (requestPath === SAMPLES_INDEX_URL) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(listSamplePdfFilenames()))
          return
        }

        const filename = decodeURIComponent(requestPath.slice(`${SAMPLES_BASE}/`.length))
        const filePath = resolveSamplePdfPath(filename)
        if (filePath === null) {
          next()
          return
        }

        res.setHeader('Content-Type', 'application/pdf')
        fs.createReadStream(filePath).pipe(res)
      })
    },
    closeBundle() {
      const targetDir = path.join(outDir, 'samples')
      fs.mkdirSync(targetDir, { recursive: true })

      for (const filename of listSamplePdfFilenames()) {
        fs.copyFileSync(path.join(SAMPLES_DIR, filename), path.join(targetDir, filename))
      }

      fs.writeFileSync(path.join(targetDir, 'index.json'), JSON.stringify(listSamplePdfFilenames()))
    },
  }
}

export default defineConfig({
  plugins: [react(), samplesPlugin()],
  server: {
    proxy: {
      '/invoices': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: API_PROXY_TIMEOUT_MS,
        proxyTimeout: API_PROXY_TIMEOUT_MS,
      },
      '/expense-reports': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: API_PROXY_TIMEOUT_MS,
        proxyTimeout: API_PROXY_TIMEOUT_MS,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
