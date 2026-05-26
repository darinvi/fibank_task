export const PDF_FILE_ACCEPT = '.pdf,application/pdf'

export function isPdfFile(file: File): boolean {
  if (file.type === 'application/pdf') {
    return true
  }
  return file.name.toLowerCase().endsWith('.pdf')
}
