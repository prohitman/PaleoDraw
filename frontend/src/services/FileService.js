// src/services/FileService.js
/**
 * Generic file I/O utilities for downloading and reading files
 * @module services/FileService
 */

/**
 * Trigger browser download of content as a file
 * Creates a temporary blob URL and automatically clicks a download link
 * @param {string} filename - Name for the downloaded file
 * @param {string|Blob} content - Content to download
 * @param {string} [mime='application/octet-stream'] - MIME type for the blob
 */
export function downloadBlob(
  filename,
  content,
  mime = "application/octet-stream"
) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Read a File object as text using FileReader API
 * @param {File} file - File object from input element or drag-drop
 * @returns {Promise<string|null>} Resolves to file text content or null if no file
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null)
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (err) => reject(err)
    reader.readAsText(file)
  })
}
