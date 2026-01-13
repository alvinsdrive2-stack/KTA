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

// Cache multiple URLs (for foto and ktp)
export async function cacheKTAPhotos(fotoUrl: string | null, ktpUrl: string | null): Promise<{
  fotoUrl: string | null
  ktpUrl: string | null
}> {
  const [cachedFoto, cachedKtp] = await Promise.all([
    fotoUrl ? cachePhotoFromUrl(fotoUrl) : null,
    ktpUrl ? cachePhotoFromUrl(ktpUrl) : null,
  ])

  return { fotoUrl: cachedFoto, ktpUrl: cachedKtp }
}
