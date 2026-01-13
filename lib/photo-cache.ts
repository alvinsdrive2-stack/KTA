import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const CACHE_DIR = path.join(process.cwd(), 'public', 'cached-photos')

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.access(CACHE_DIR)
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  }
}

// Generate a safe filename from URL
function getCacheFilename(url: string): string {
  const hash = crypto.createHash('md5').update(url).digest('hex')
  const ext = url.split('.').pop()?.split('?')[0] || 'jpg'
  return `${hash}.${ext}`
}

// Download and cache photo from URL
export async function cachePhotoFromUrl(url: string): Promise<string | null> {
  if (!url || !url.startsWith('http')) {
    return url // Return as-is if not a URL
  }

  try {
    await ensureCacheDir()

    const filename = getCacheFilename(url)
    const cachedPath = path.join(CACHE_DIR, filename)

    // Check if already cached
    try {
      await fs.access(cachedPath)
      console.log('Photo already cached:', filename)
      return `/cached-photos/${filename}`
    } catch {
      // Not cached, download it
    }

    // Download photo with proper headers
    console.log('Downloading photo from:', url)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.error('Failed to download photo:', response.statusText)
      return url // Return original URL if download fails
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Save to cache
    await fs.writeFile(cachedPath, buffer)
    console.log('Photo cached successfully:', filename)

    return `/cached-photos/${filename}`
  } catch (error) {
    console.error('Error caching photo:', error)
    return url // Return original URL if caching fails
  }
}

// Cache base64 data directly (for client-fetched photos)
export async function cacheBase64Data(base64Data: string, prefix: string = 'photo'): Promise<string | null> {
  if (!base64Data) {
    return null
  }

  try {
    await ensureCacheDir()

    // Parse base64 data: "data:image/xxx;base64,..."
    const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const buffer = Buffer.from(base64String, 'base64')

    // Detect file extension from data URL or default to jpg
    let ext = 'jpg'
    if (base64Data.includes('data:image/')) {
      const match = base64Data.match(/data:image\/(\w+);base64/)
      if (match) {
        ext = match[1] === 'jpeg' ? 'jpg' : match[1]
      }
    }

    // Generate unique filename
    const hash = crypto.createHash('md5').update(base64String).digest('hex')
    const filename = `${prefix}-${hash}.${ext}`
    const cachedPath = path.join(CACHE_DIR, filename)

    // Save to cache
    await fs.writeFile(cachedPath, buffer)
    console.log(`Base64 ${prefix} cached successfully:`, filename)

    return `/cached-photos/${filename}`
  } catch (error) {
    console.error(`Error caching base64 ${prefix}:`, error)
    return null
  }
}

// Cache multiple URLs or base64 data (for foto and ktp)
export async function cacheKTAPhotos(
  fotoUrl: string | null,
  ktpUrl: string | null,
  fotoData?: string,
  ktpData?: string
): Promise<{
  fotoUrl: string | null
  ktpUrl: string | null
}> {
  const [cachedFoto, cachedKtp] = await Promise.all([
    // Prioritize fotoData (base64) over fotoUrl
    fotoData
      ? cacheBase64Data(fotoData, 'foto')
      : fotoUrl
      ? cachePhotoFromUrl(fotoUrl)
      : null,
    // Prioritize ktpData (base64) over ktpUrl
    ktpData
      ? cacheBase64Data(ktpData, 'ktp')
      : ktpUrl
      ? cachePhotoFromUrl(ktpUrl)
      : null,
  ])

  return { fotoUrl: cachedFoto, ktpUrl: cachedKtp }
}
