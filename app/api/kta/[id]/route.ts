import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
      include: {
        requestedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
        klasifikasi: {
          select: {
            id: true,
            idKlasifikasi: true,
            idSubklasifikasi: true,
            kodeSubklasifikasi: true,
            subklasifikasi: true,
          },
        },
        payments: {
          include: {
            bulkPayment: {
              select: {
                id: true,
                buktiPembayaranUrl: true,
                status: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        documents: true,
        approvals: {
          include: {
            approvedByUser: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Check if user has access based on role
    switch (session.user.role) {
      case 'DAERAH':
        // DAERAH users can only see requests from their assigned daerah
        if (session.user.daerahId !== ktaRequest.daerahId) {
          return NextResponse.json({ error: 'Forbidden - Not from your daerah' }, { status: 403 })
        }
        break

      case 'PUSAT':
      case 'ADMIN':
        // PUSAT and ADMIN can see all requests
        break

      default:
        // For other roles, only allow if they created the request
        if (ktaRequest.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        break
    }

    return NextResponse.json({
      success: true,
      data: ktaRequest,
    })
  } catch (error) {
    console.error('Get KTA error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}