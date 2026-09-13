import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth-helpers'
import { saveUpload, keyToUrl, EXT_BY_MIME, MAX_UPLOAD_BYTES } from '@/lib/upload-storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validasi tipe & ukuran juga ada di saveUpload(); dicek di sini lagi
    // biar pesan errornya jelas buat pemakai.
    if (!EXT_BY_MIME[file.type]) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    const key = await saveUpload(file, 'documents', type)

    return NextResponse.json({
      success: true,
      url: keyToUrl(key),
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
