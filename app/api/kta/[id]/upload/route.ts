import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

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

    // For now, just save the file info. In production, you'd upload to cloud storage
    const fileName = `${params.id}-${type}-${Date.now()}.${file.type.split('/')[1]}`
    const fileUrl = `/uploads/${fileName}`

    // Update KTA request with file URL
    const updateData: any = {}
    if (type === 'ktp') {
      updateData.ktpUrl = fileUrl
    } else if (type === 'foto') {
      updateData.fotoUrl = fileUrl
    }

    const ktaRequest = await prisma.kTARequest.update({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: updateData,
    })

    // TODO: Actually save the file to storage
    // const buffer = Buffer.from(await file.arrayBuffer())
    // await fs.writeFile(`./public${fileUrl}`, buffer)

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