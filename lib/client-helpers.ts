/**
 * Client-side helper functions for handling images and data
 * These functions run in the browser, useful for geo-blocked URLs
 */

/**
 * Convert a Blob to base64 string
 * @param blob - The blob to convert
 * @returns Promise<string> - Base64 data URL
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert blob to base64'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Fetch an image from URL and convert to base64
 * Useful for geo-blocked URLs - fetch from client (in Indonesia) instead of server
 * @param url - The image URL to fetch
 * @returns Promise<string | null> - Base64 data URL or null if failed
 */
export async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Failed to fetch image:', response.statusText)
      return null
    }
    const blob = await response.blob()
    return await blobToBase64(blob)
  } catch (error) {
    console.error('Error fetching image:', error)
    return null
  }
}

/**
 * Fetch multiple images and convert to base64
 * @param urls - Object with fotoUrl and ktpUrl properties
 * @returns Promise with fotoData and ktpData as base64 strings
 */
export async function fetchImagesAsBase64(urls: {
  fotoUrl?: string
  ktpUrl?: string
}): Promise<{ fotoData?: string; ktpData?: string }> {
  const result: { fotoData?: string; ktpData?: string } = {}

  if (urls.fotoUrl) {
    result.fotoData = await fetchImageAsBase64(urls.fotoUrl) || undefined
  }
  if (urls.ktpUrl) {
    result.ktpData = await fetchImageAsBase64(urls.ktpUrl) || undefined
  }

  return result
}

/**
 * Download a base64 string as a file
 * @param base64Data - The base64 data URL
 * @param filename - The filename to save as
 */
export function downloadBase64AsFile(base64Data: string, filename: string) {
  const link = document.createElement('a')
  link.href = base64Data
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
