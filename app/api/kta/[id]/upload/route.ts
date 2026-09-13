import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { saveUpload, keyToUrl } from '@/lib/upload-storage'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !type) {
      return NextResponse.json(
        { error: 'File and type are required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (type === 'ktp' && !file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Invalid file type for KTP' },
        { status: 400 }
      )
    }

    if (type === 'foto' && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type for photo' },
        { status: 400 }
      )
    }

    // Simpan filenya beneran ke disk, baru catat URL-nya.
    let fileUrl: string
    try {
      const key = await saveUpload(file, 'documents', `${params.id}-${type}`)
      fileUrl = keyToUrl(key)
    } catch (uploadError) {
      return NextResponse.json(
        { error: uploadError instanceof Error ? uploadError.message : 'Upload gagal' },
        { status: 400 }
      )
    }

    const updateData: Record<string, string> = {}
    if (type === 'ktp') {
      updateData.ktpUrl = fileUrl
    } else if (type === 'foto') {
      updateData.fotoUrl = fileUrl
    }

    const existingRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      select: { id: true, requestedBy: true },
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    if (
      existingRequest.requestedBy !== session.user.id &&
      session.user.role !== 'ADMIN' &&
      session.user.role !== 'PUSAT'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ktaRequest = await prisma.kTARequest.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: ktaRequest,
      fileUrl,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}