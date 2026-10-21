import { NextRequest, NextResponse } from 'next/server'
import { Prisma, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { buildDateRange, buildRiwayatScope, KODE_DAERAH_PUSAT } from '@/lib/riwayat-invoice'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only DAERAH, PUSAT, ADMIN or KEUANGAN users can access bulk payments
    if (session.user.role !== 'DAERAH' && session.user.role !== 'PUSAT' && session.user.role !== 'ADMIN' && session.user.role !== 'KEUANGAN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'
    const status = searchParams.get('status')
    const pusatParam = searchParams.get('pusat') === 'true'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const daerahKode = searchParams.get('daerahKode')
    const daftarDaerah = searchParams.get('daftarDaerah') === 'true'

    // Build where clause
    const where: Prisma.BulkPaymentWhereInput = {}

    // Scope role: DAERAH = daerahnya sendiri, PUSAT = cuma daerah Pusat (BPP),
    // ADMIN/KEUANGAN = semua. `undefined` berarti role nggak dikenal -> ditolak.
    const scope = buildRiwayatScope(session.user)
    if (!scope) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    Object.assign(where, scope)

    // Filter daerah dari dropdown. Cuma berlaku buat yang memang boleh lihat
    // lintas daerah (ADMIN/KEUANGAN) — scope di atas tetap menang.
    if (daerahKode && daerahKode !== 'all' && (session.user.role === 'ADMIN' || session.user.role === 'KEUANGAN')) {
      where.daerah = { kodeDaerah: daerahKode }
    }

    // Filter tanggal terbit invoice, dibaca sebagai tanggal WIB.
    const rentang = buildDateRange({ start: startDate, end: endDate })
    if (rentang.gte || rentang.lte) {
      where.createdAt = rentang
    }

    // Filter by status if provided. Nilai di luar enum diabaikan — dulu
    // `?status=<ngawur>` dilempar apa adanya ke Prisma dan jadi 500.
    const STATUS_VALID: PaymentStatus[] = ['PENDING', 'PAID', 'VERIFIED', 'REJECTED']
    if (status && (STATUS_VALID as string[]).includes(status)) {
      where.status = status as PaymentStatus
    } else if (!all) {
      // If not fetching all and no status specified, only get PENDING invoices
      where.status = 'PENDING'
    }

    // Dropdown filter daerah: daftar provinsi yang beneran punya invoice,
    // dibatasi ke yang boleh dilihat user ini.
    if (daftarDaerah) {
      const daftar = await prisma.daerah.findMany({
        where: {
          ...(session.user.role === 'PUSAT' ? { kodeDaerah: KODE_DAERAH_PUSAT } : {}),
          bulkPayments: { some: {} },
        },
        select: { id: true, namaDaerah: true, kodeDaerah: true },
        orderBy: { namaDaerah: 'asc' },
      })

      return NextResponse.json({ success: true, data: daftar })
    }

    const bulkPayments = await prisma.bulkPayment.findMany({
      where,
      include: {
        payments: {
          include: {
            ktaRequest: {
              select: {
                id: true,
                idIzin: true,
                nama: true,
                jenjang: true
              }
            }
          }
        },
        daerah: {
          select: {
            namaDaerah: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: bulkPayments
    })
  } catch (error) {
    console.error('Error fetching bulk payments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
