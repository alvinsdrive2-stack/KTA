import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readUpload, contentTypeFor } from '@/lib/upload-storage'

export const dynamic = 'force-dynamic'

/**
 * Satu-satunya pintu keluar buat file upload.
 *
 * Sebelumnya file disimpan di `public/uploads/` dan disajikan statis sama Next.js —
 * jadi bisa diakses langsung tanpa lewat sini, alias cek session di bawah ini
 * ke-bypass total. Sekarang file ada di `storage/uploads/` (di luar `public/`)
 * dan cuma bisa keluar lewat route ini.
 *
 * Bentuk URL tetap `/uploads/<key>`, jadi frontend nggak perlu diubah.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const key = params.path.join('/')

    // readUpload() sudah nolak key yang keluar dari root (path traversal).
    const file = await readUpload(key)

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': contentTypeFor(key),
        // `private` — file ini data pribadi anggota, jangan sampai disimpan
        // di cache publik atau proxy.
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Serve file error:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
