import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')

    // Build where clause
    const where: any = {}

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { namaDaerah: { contains: search, mode: 'insensitive' } },
        { kodeDaerah: { contains: search, mode: 'insensitive' } },
        { kodePropinsi: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Fetch daerah data
    const daerahList = await prisma.daerah.findMany({
      where,
      orderBy: [
        { kodePropinsi: 'asc' },
        { namaDaerah: 'asc' }
      ],
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        kodePropinsi: true,
        isActive: true,
        _count: {
          select: {
            users: true,
            ktaRequests: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: daerahList,
      total: daerahList.length
    })

  } catch (error) {
    console.error('Get daerah list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await authMiddleware(request)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PUSAT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { namaDaerah, kodeDaerah, kodePropinsi, alamat, telepon, email } = body

    // Validate required fields
    if (!namaDaerah || !kodeDaerah) {
      return NextResponse.json(
        { error: 'Nama daerah dan kode daerah harus diisi' },
        { status: 400 }
      )
    }

    // Check if kodeDaerah already exists
    const existingDaerah = await prisma.daerah.findUnique({
      where: { kodeDaerah }
    })

    if (existingDaerah) {
      return NextResponse.json(
        { error: 'Kode daerah sudah digunakan' },
        { status: 400 }
      )
    }

    // Create new daerah
    const newDaerah = await prisma.daerah.create({
      data: {
        namaDaerah,
        kodeDaerah,
        kodePropinsi,
        alamat,
        telepon,
        email
      }
    })

    return NextResponse.json({
      success: true,
      data: newDaerah,
      message: 'Daerah berhasil ditambahkan'
    })

  } catch (error) {
    console.error('Create daerah error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}