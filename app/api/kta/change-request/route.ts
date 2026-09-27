import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { getFieldDef, readFieldValue, isSameValue } from '@/lib/kta-change-request'

export const dynamic = 'force-dynamic'

/**
 * Permohonan perubahan KTA.
 *
 * POST = BPP (role PUSAT) ngajuin perubahan satu field.
 * GET  = daftar permohonan. BPP/ADMIN/KEUANGAN lihat semua, DAERAH nggak boleh.
 */

/** Role yang boleh mengajukan permohonan. Cuma BPP. */
const PENGAJU = ['PUSAT']
/** Role yang boleh melihat daftarnya. */
const PELIHAT = ['PUSAT', 'ADMIN', 'KEUANGAN']

export async function GET(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!PELIHAT.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const ktaRequestId = searchParams.get('ktaRequestId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (status && (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED')) {
      where.status = status
    }

    if (ktaRequestId) {
      where.ktaRequestId = ktaRequestId
    }

    // Nyari berdasarkan nama/NIK/ID Izin anggota yang diajukan perubahannya.
    // Collation tabelnya utf8mb4_*_ci, jadi `contains` sudah case-insensitive.
    if (search) {
      where.ktaRequest = {
        OR: [
          { nama: { contains: search } },
          { nik: { contains: search } },
          { idIzin: { contains: search } },
        ],
      }
    }

    const [rows, total] = await Promise.all([
      prisma.kTAChangeRequest.findMany({
        where,
        select: {
          id: true,
          ktaRequestId: true,
          fieldName: true,
          oldValue: true,
          newValue: true,
          reason: true,
          buktiUrl: true,
          idIzinInput: true,
          sikiValue: true,
          status: true,
          reviewedAt: true,
          catatan: true,
          appliedAt: true,
          createdAt: true,
          updatedAt: true,
          ktaRequest: {
            select: {
              id: true,
              nama: true,
              nik: true,
              idIzin: true,
              nomorKTA: true,
              daerah: { select: { id: true, namaDaerah: true, kodeDaerah: true } },
            },
          },
          requestedByUser: { select: { id: true, name: true } },
          reviewedByUser: { select: { id: true, name: true } },
        },
        // Yang belum diputus naik ke atas — itu yang nunggu dikerjain.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.kTAChangeRequest.count({ where }),
    ])

    // Jumlah yang masih nunggu konfirmasi, buat badge di nav Keuangan.
    // Dihitung terpisah dari `total` karena `total` ikut filter status.
    const pendingCount = await prisma.kTAChangeRequest.count({
      where: { status: 'PENDING' },
    })

    return NextResponse.json({
      success: true,
      data: rows,
      pendingCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('List permohonan perubahan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!PENGAJU.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Hanya BPP yang bisa mengajukan permohonan perubahan KTA' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ktaRequestId, fieldName, newValue, reason, buktiUrl, idIzinInput } = body as {
      ktaRequestId?: string
      fieldName?: string
      newValue?: string
      reason?: string
      buktiUrl?: string
      idIzinInput?: string | null
    }

    if (!ktaRequestId) {
      return NextResponse.json({ error: 'KTA yang mau diubah belum dipilih' }, { status: 400 })
    }

    // Validasi whitelist. Ini penjaga utamanya: `fieldName` dari body nggak
    // pernah dipakai langsung sebagai nama kolom Prisma.
    const def = fieldName ? getFieldDef(fieldName) : undefined
    if (!def) {
      return NextResponse.json(
        { error: 'Field yang mau diubah nggak dikenali' },
        { status: 400 }
      )
    }

    const nilaiBaru = typeof newValue === 'string' ? newValue.trim() : ''
    if (!nilaiBaru) {
      return NextResponse.json(
        { error: `Nilai baru untuk ${def.label} nggak boleh kosong` },
        { status: 400 }
      )
    }

    const alasan = typeof reason === 'string' ? reason.trim() : ''
    if (!alasan) {
      return NextResponse.json({ error: 'Alasan permohonan wajib diisi' }, { status: 400 })
    }

    if (!buktiUrl || typeof buktiUrl !== 'string') {
      return NextResponse.json({ error: 'Bukti permohonan wajib di-upload' }, { status: 400 })
    }

    const kta = await prisma.kTARequest.findUnique({
      where: { id: ktaRequestId },
      select: {
        id: true,
        nama: true,
        nik: true,
        jabatanKerja: true,
        jenjang: true,
        noTelp: true,
        email: true,
        alamat: true,
        subklasifikasi: true,
      },
    })

    if (!kta) {
      return NextResponse.json({ error: 'Data KTA nggak ketemu' }, { status: 404 })
    }

    // Snapshot nilai lama SEKARANG. Keuangan mengonfirmasi nilai di titik ini,
    // bukan nilai KTA yang mungkin sudah berubah belakangan.
    const oldValue = readFieldValue(kta as Record<string, unknown>, def.key)

    if (isSameValue(oldValue, nilaiBaru)) {
      return NextResponse.json(
        { error: `Nilai ${def.label} masih sama dengan yang sekarang, nggak ada yang perlu diubah` },
        { status: 400 }
      )
    }

    // Satu KTA cuma boleh punya satu permohonan yang belum diputus. Tanpa
    // penjaga ini, dua permohonan buat field yang sama bisa jalan bareng dan
    // yang belakangan nimpa hasil yang duluan.
    const masihPending = await prisma.kTAChangeRequest.findFirst({
      where: { ktaRequestId, status: 'PENDING' },
      select: { id: true },
    })

    if (masihPending) {
      return NextResponse.json(
        { error: 'KTA ini masih punya permohonan yang belum dikonfirmasi Keuangan. Tunggu diputus dulu.' },
        { status: 409 }
      )
    }

    // ID Izin opsional. Kalau diisi, tarik nilainya dari SIKI buat pembanding —
    // disimpan sebagai snapshot supaya halaman Keuangan nggak perlu fetch ulang
    // (URL SIKI sering ke-block dari server).
    let sikiValue: string | null = null
    const izinUntukDibanding = typeof idIzinInput === 'string' ? idIzinInput.trim() : ''

    if (izinUntukDibanding && def.sikiKey) {
      try {
        const { sikiApi } = await import('@/lib/siki-api')
        const sikiResponse = await sikiApi.getPekerjaByIdIzin(izinUntukDibanding)
        if (sikiResponse?.success && sikiResponse.data) {
          const raw = (sikiResponse.data as unknown as Record<string, unknown>)[def.sikiKey]
          sikiValue = raw === null || raw === undefined ? null : String(raw)
        }
      } catch (err) {
        // SIKI lagi nggak bisa diakses bukan alasan buat nolak permohonan.
        // Pembandingnya aja yang kosong — Keuangan tetap bisa konfirmasi manual.
        console.warn('Gagal ambil pembanding SIKI:', err)
      }
    }

    const dibuat = await prisma.kTAChangeRequest.create({
      data: {
        ktaRequestId,
        requestedBy: session.user.id,
        fieldName: def.key,
        oldValue,
        newValue: nilaiBaru,
        reason: alasan,
        buktiUrl,
        idIzinInput: izinUntukDibanding || null,
        sikiValue,
      },
      select: { id: true },
    })

    return NextResponse.json({
      success: true,
      message: 'Permohonan perubahan terkirim, nunggu konfirmasi Keuangan',
      data: { id: dibuat.id },
    })
  } catch (error) {
    console.error('Ajukan permohonan perubahan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
