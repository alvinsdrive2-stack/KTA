import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// Whitelist field yang boleh di-sort (mencegah injection)
const sortFields: Record<string, string> = {
  nama: 'nama',
  nik: 'nik',
  idIzin: 'idIzin',
  jenjang: 'jenjang',
  jabatanKerja: 'jabatanKerja',
  status: 'status',
  nomorKTA: 'nomorKTA',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
}

function buildOrderBy(sortBy: string | null, sortDir: 'asc' | 'desc'): any {
  if (!sortBy) {
    return { createdAt: 'desc' }
  }
  if (sortBy === 'daerah') {
    return { daerah: { namaDaerah: sortDir } }
  }
  if (sortFields[sortBy]) {
    return { [sortFields[sortBy]]: sortDir }
  }
  return { createdAt: 'desc' }
}

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const statuses = searchParams.getAll('status') // Get all status values
    const daerahKode = searchParams.get('daerahKode')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy')
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build where clause based on user role
    let whereClause: any = {}

    switch (session.user.role) {
      case 'DAERAH':
        // DAERAH users can only see requests from their assigned daerah
        if (session.user.daerahId) {
          whereClause.daerahId = session.user.daerahId
        } else {
          // If DAERAH user has no daerah assignment, return empty result
          return NextResponse.json({
            success: true,
            data: [],
            message: 'User belum di-assign ke daerah'
          })
        }
        break

      case 'PUSAT':
        // PUSAT users can see all requests
        break

      case 'ADMIN':
        // ADMIN can see all requests
        break

      case 'KEUANGAN':
        // KEUANGAN users can see all requests
        break

      default:
        // Unknown role - return empty
        return NextResponse.json({
          success: true,
          data: [],
          message: 'Invalid user role'
        })
    }

    // Additional daerah filter only applies to PUSAT/ADMIN/KEUANGAN
    if ((session.user.role === 'PUSAT' || session.user.role === 'ADMIN' || session.user.role === 'KEUANGAN') && daerahKode && daerahKode !== 'all') {
      whereClause.daerah = {
        kodeDaerah: daerahKode
      }
    }

    if (status) {
      // If multiple statuses are sent, use 'in' operator
      if (statuses.length > 1) {
        whereClause.status = { in: statuses }
      } else {
        whereClause.status = status
      }
    }

    if (daerahKode && (session.user.role === 'PUSAT' || session.user.role === 'ADMIN' || session.user.role === 'KEUANGAN')) {
      // Only allow daerah filter for PUSAT/ADMIN/KEUANGAN users
      whereClause.daerah = {
        kodeDaerah: daerahKode
      }
    }

    if (search) {
      whereClause.OR = [
        { nama: { contains: search } },
        { idIzin: { contains: search } },
        { nik: { contains: search } }
      ]
    }

    // Filter by date range on createdAt
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) whereClause.createdAt.gte = new Date(startDate)
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        whereClause.createdAt.lte = endDateTime
      }
    }


    const [ktaRequests, total] = await Promise.all([
      prisma.kTARequest.findMany({
        where: whereClause,
        select: {
          id: true,
          idIzin: true,
          nik: true,
          nama: true,
          jabatanKerja: true,
          subklasifikasi: true,
          jenjang: true,
          noTelp: true,
          email: true,
          alamat: true,
          tanggalDaftar: true,
          status: true,
          hargaRegion: true,
          pusatApprovedBy: true,
          pusatApprovedAt: true,
          kartuGeneratedPath: true,
          qrCodePath: true,
          nomorKTA: true,
          createdAt: true,
          updatedAt: true,
          fotoUrl: true,
          fotoData: true,
          ktpUrl: true,
          subklasifikasiId: true,
          diskonPersen: true,
          hargaBase: true,
          hargaFinal: true,
          requestedByUser: {
            select: {
              id: true,
              name: true,
            },
          },
          daerah: {
            select: {
              id: true,
              namaDaerah: true,
              kodeDaerah: true,
            },
          },
          payments: {
            include: {
              bulkPayment: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  status: true,
                }
              }
            }
          },
        },
        orderBy: buildOrderBy(sortBy, sortDir),
        skip: offset,
        take: limit,
      }),
      prisma.kTARequest.count({ where: whereClause }),
    ])

    return NextResponse.json({
      success: true,
      data: ktaRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}