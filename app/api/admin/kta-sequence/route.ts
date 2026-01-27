import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// GET - List all daerah with their KTA sequences
export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN and PUSAT can view sequences
    if (session.user.role !== 'ADMIN' && session.user.role !== 'PUSAT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const daerahId = searchParams.get('daerahId')

    const where: any = {}
    if (daerahId) {
      where.id = daerahId
    }

    const daerahList = await prisma.daerah.findMany({
      where,
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        kodePropinsi: true,
        isActive: true,
        lastSequenceAhli: true,
        lastSequenceTeknisi: true,
        lastSequenceOperator: true,
      },
      orderBy: [
        { kodePropinsi: 'asc' },
        { namaDaerah: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: daerahList,
      total: daerahList.length
    })

  } catch (error) {
    console.error('Get KTA sequences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update KTA sequence for specific daerah
export async function PUT(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can update sequences
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { daerahId, lastSequenceAhli, lastSequenceTeknisi, lastSequenceOperator } = body

    if (!daerahId) {
      return NextResponse.json(
        { error: 'Daerah ID is required' },
        { status: 400 }
      )
    }

    // Validate daerah exists
    const daerah = await prisma.daerah.findUnique({
      where: { id: daerahId }
    })

    if (!daerah) {
      return NextResponse.json(
        { error: 'Daerah not found' },
        { status: 404 }
      )
    }

    // Build update data dynamically based on provided fields
    const updateData: any = {}
    if (typeof lastSequenceAhli === 'number') {
      updateData.lastSequenceAhli = lastSequenceAhli
    }
    if (typeof lastSequenceTeknisi === 'number') {
      updateData.lastSequenceTeknisi = lastSequenceTeknisi
    }
    if (typeof lastSequenceOperator === 'number') {
      updateData.lastSequenceOperator = lastSequenceOperator
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'At least one sequence field must be provided' },
        { status: 400 }
      )
    }

    // Update daerah
    const updatedDaerah = await prisma.daerah.update({
      where: { id: daerahId },
      data: updateData,
      select: {
        id: true,
        namaDaerah: true,
        kodeDaerah: true,
        lastSequenceAhli: true,
        lastSequenceTeknisi: true,
        lastSequenceOperator: true,
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedDaerah,
      message: 'KTA sequence updated successfully'
    })

  } catch (error) {
    console.error('Update KTA sequence error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Bulk update KTA sequences
export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can bulk update sequences
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { sequences } = body

    if (!sequences || !Array.isArray(sequences)) {
      return NextResponse.json(
        { error: 'Sequences array is required' },
        { status: 400 }
      )
    }

    const results = []

    for (const seq of sequences) {
      const { daerahId, lastSequenceAhli, lastSequenceTeknisi, lastSequenceOperator } = seq

      if (!daerahId) {
        results.push({ success: false, error: 'Daerah ID is required', data: seq })
        continue
      }

      try {
        const updateData: any = {}
        if (typeof lastSequenceAhli === 'number') {
          updateData.lastSequenceAhli = lastSequenceAhli
        }
        if (typeof lastSequenceTeknisi === 'number') {
          updateData.lastSequenceTeknisi = lastSequenceTeknisi
        }
        if (typeof lastSequenceOperator === 'number') {
          updateData.lastSequenceOperator = lastSequenceOperator
        }

        if (Object.keys(updateData).length === 0) {
          results.push({ success: false, error: 'No valid sequence fields', data: seq })
          continue
        }

        const updated = await prisma.daerah.update({
          where: { id: daerahId },
          data: updateData,
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true,
            lastSequenceAhli: true,
            lastSequenceTeknisi: true,
            lastSequenceOperator: true,
          }
        })

        results.push({ success: true, data: updated })
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: seq
        })
      }
    }

    const successCount = results.filter((r: any) => r.success).length
    const failCount = results.filter((r: any) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} sequences${failCount > 0 ? ` (${failCount} failed)` : ''}`,
      results
    })

  } catch (error) {
    console.error('Bulk update KTA sequences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
