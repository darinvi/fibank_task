import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXAMPLE_PDFS_DIR = path.resolve(__dirname, 'public/example-pdfs')
const EXAMPLE_PDFS_INDEX_URL = '/example-pdfs/index.json'
/** Allow slow OpenAI-backed invoice extract / chat requests through the dev proxy. */
const API_PROXY_TIMEOUT_MS = 3 * 60 * 1000

function listExamplePdfFilenames(): string[] {
  if (!fs.existsSync(EXAMPLE_PDFS_DIR)) {
    return []
  }

  return fs
    .readdirSync(EXAMPLE_PDFS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b))
}

function examplePdfsPlugin(): Plugin {
  let outDir = path.resolve(__dirname, 'dist')

  return {
    name: 'example-pdfs-index',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestPath = req.url?.split('?')[0]
        if (requestPath !== EXAMPLE_PDFS_INDEX_URL) {
          next()
          return
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(listExamplePdfFilenames()))
      })
    },
    closeBundle() {
      const targetDir = path.join(outDir, 'example-pdfs')
      fs.mkdirSync(targetDir, { recursive: true })
      fs.writeFileSync(
        path.join(targetDir, 'index.json'),
        JSON.stringify(listExamplePdfFilenames()),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), examplePdfsPlugin()],
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
