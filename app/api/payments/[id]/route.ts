import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user

    // Halaman ini halaman verifikasi — cuma KEUANGAN yang boleh buka.
    if (user.role !== 'KEUANGAN') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki akses' },
        { status: 403 }
      )
    }

    const payment = await prisma.bulkPayment.findUnique({
      where: { id: params.id },
      include: {
        submittedByUser: {
          select: {
            name: true,
          }
        },
        verifiedByUser: {
          select: {
            name: true,
          }
        },
        daerah: true,
        payments: {
          include: {
            ktaRequest: {
              select: {
                id: true,
                idIzin: true,
                nama: true,
                nik: true,
                jenjang: true,
                jabatanKerja: true,
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    // Invoice yang pernah dibuatkan token Midtrans dilempar ke sini sebagai
    // 404 "tidak ditemukan" — itu buat mencegah verifikasi manual atas
    // pembayaran yang seharusnya auto-verified. Tapi yang belum dibayar
    // (PENDING) tetap harus bisa dibuka: BPP bisa membayarnya lewat transfer
    // manual atau pengajuan dinas, dan halaman detailnya butuh data ini.
    const sudahBayarMidtrans = payment.midtransTransactionId && payment.status !== 'PENDING'
    if (sudahBayarMidtrans) {
      return NextResponse.json(
        { success: false, error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    const response = {
      id: payment.id,
      invoiceNumber: payment.invoiceNumber,
      totalJumlah: payment.totalJumlah,
      totalNominal: payment.totalNominal,
      gratis: payment.gratis,
      buktiPembayaranUrl: payment.buktiPembayaranUrl,
      status: payment.status,
      isEnrolment: payment.isEnrolment,
      keterangan: payment.keterangan,
      submittedByUser: {
        name: payment.submittedByUser.name,
      },
      verifiedByUser: payment.verifiedByUser ? {
        name: payment.verifiedByUser.name,
      } : null,
      verifiedAt: payment.verifiedAt,
      createdAt: payment.createdAt,
      daerah: {
        namaDaerah: payment.daerah.namaDaerah,
        kodeDaerah: payment.daerah.kodeDaerah,
      },
      payments: payment.payments.map(p => ({
        id: p.id,
        ktaRequest: p.ktaRequest,
      }))
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('Get payment detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
