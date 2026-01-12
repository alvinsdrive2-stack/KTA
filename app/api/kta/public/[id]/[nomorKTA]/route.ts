import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET endpoint untuk public KTA verification (no auth required)
// URL: /api/kta/public/[id]/[nomorKTA]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; nomorKTA: string } }
) {
  try {
    const { id, nomorKTA } = params

    // Fetch KTA dengan public data saja
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: {
        id,
        nomorKTA,
      },
      select: {
        id: true,
        nomorKTA: true,
        nama: true,
        alamat: true,
        noTelp: true,
        email: true,
        createdAt: true,
        jenjang: true,
        status: true,
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
          },
        },
      },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA not found' }, { status: 404 })
    }

    // Hanya tampilkan KTA yang sudah approved
    if (ktaRequest.status !== 'APPROVED_BY_PUSAT' &&
        ktaRequest.status !== 'READY_TO_PRINT' &&
        ktaRequest.status !== 'PRINTED') {
      return NextResponse.json({ error: 'KTA not yet approved' }, { status: 403 })
    }

    // Format data untuk public view
    const expiredDate = new Date(ktaRequest.createdAt)
    expiredDate.setFullYear(expiredDate.getFullYear() + 5)

    // Format no telp: hanya 4 digit terakhir dengan +62 8
    let formattedPhone = ''
    if (ktaRequest.noTelp) {
      const phone = ktaRequest.noTelp.replace(/\D/g, '') // remove non-digits
      if (phone.length >= 4) {
        const last4 = phone.slice(-4)
        formattedPhone = `+62 8** **${last4}`
      }
    }

    // Format email: 5 huruf pertama + ***@domain
    let formattedEmail = ''
    if (ktaRequest.email) {
      const [localPart, domain] = ktaRequest.email.split('@')
      if (localPart && domain) {
        const visible = localPart.slice(0, 5)
        formattedEmail = `${visible}***@${domain}`
      }
    }

    // Tentukan keahlian berdasarkan jenjang
    let keahlian = ''
    const jenjangNum = parseInt(ktaRequest.jenjang, 10)
    if (jenjangNum >= 1 && jenjangNum <= 3) {
      keahlian = 'Operator'
    } else if (jenjangNum >= 4 && jenjangNum <= 6) {
      keahlian = 'Teknisi'
    } else if (jenjangNum >= 7 && jenjangNum <= 9) {
      keahlian = 'Ahli'
    }

    // Return public data
    return NextResponse.json({
      nomorKTA: ktaRequest.nomorKTA,
      nama: ktaRequest.nama,
      alamat: ktaRequest.alamat,
      noTelp: formattedPhone,
      email: formattedEmail,
      tanggalKadaluarsa: expiredDate.toISOString().split('T')[0],
      daerah: ktaRequest.daerah?.namaDaerah || '',
      keahlian,
    })
  } catch (error) {
    console.error('Error fetching KTA for verification:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
