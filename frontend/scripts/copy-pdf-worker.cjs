const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
const dest = path.join(__dirname, '../public/pdf.worker.min.js')

if (!fs.existsSync(src)) {
  console.warn('pdfjs-dist worker not found; run npm install first.')
  process.exit(0)
}

const destDir = path.dirname(dest)
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true })
}

fs.copyFileSync(src, dest)
