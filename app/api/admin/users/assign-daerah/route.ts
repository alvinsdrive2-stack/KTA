import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin/pusat role
    const session = await authMiddleware(request)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PUSAT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, daerahId } = body

    // Validate inputs
    if (!userId || !daerahId) {
      return NextResponse.json(
        { error: 'User ID dan Daerah ID harus diisi' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if daerah exists
    const daerah = await prisma.daerah.findUnique({
      where: { id: daerahId },
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        kodePropinsi: true
      }
    })

    if (!daerah) {
      return NextResponse.json(
        { error: 'Daerah tidak ditemukan' },
        { status: 404 }
      )
    }

    // Update user's daerah assignment
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { daerahId: daerahId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true,
            kodePropinsi: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.name} berhasil ditugaskan ke ${daerah.namaDaerah}`,
      data: updatedUser
    })

  } catch (error) {
    console.error('Assign daerah error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication and admin/pusat role
    const session = await authMiddleware(request)
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'PUSAT')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID harus diisi' },
        { status: 400 }
      )
    }

    // Remove user's daerah assignment
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { daerahId: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      message: `User ${updatedUser.name} berhasil dihapus dari daerah`,
      data: updatedUser
    })

  } catch (error) {
    console.error('Remove daerah assignment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}