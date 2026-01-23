import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { VerifyKTAPageClient } from './page-client'

async function getKTAData(id: string, nomorKTA: string) {
  try {
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
        jabatanKerja: true,
        status: true,
        fotoUrl: true,
        daerah: {
          select: {
            id: true,
            namaDaerah: true,
            kodeDaerah: true,
          },
        },
      },
    })

    if (!ktaRequest) {
      return null
    }

    // Hanya tampilkan KTA yang sudah approved
    if (ktaRequest.status !== 'APPROVED_BY_PUSAT' &&
        ktaRequest.status !== 'READY_TO_PRINT' &&
        ktaRequest.status !== 'PRINTED') {
      return null
    }

    // Format data
    const expiredDate = new Date(ktaRequest.createdAt)
    expiredDate.setFullYear(expiredDate.getFullYear() + 5)

    // Format no telp: hanya 4 digit terakhir dengan +62 8
    let formattedPhone = ''
    if (ktaRequest.noTelp) {
      const phone = ktaRequest.noTelp.replace(/\D/g, '')
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

    // Tentukan kualifikasi berdasarkan jenjang
    let kualifikasi = ''
    const jenjangNum = parseInt(ktaRequest.jenjang, 10)
    if (jenjangNum >= 1 && jenjangNum <= 3) {
      kualifikasi = 'Operator'
    } else if (jenjangNum >= 4 && jenjangNum <= 6) {
      kualifikasi = 'Teknisi/Analis'
    } else if (jenjangNum >= 7 && jenjangNum <= 9) {
      kualifikasi = 'Ahli'
    }

    return {
      nomorKTA: ktaRequest.nomorKTA!,
      nama: ktaRequest.nama,
      alamat: ktaRequest.alamat,
      noTelp: formattedPhone,
      email: formattedEmail,
      tanggalKadaluarsa: expiredDate.toISOString().split('T')[0],
      daerah: ktaRequest.daerah?.namaDaerah || '',
      kodeDaerah: ktaRequest.daerah?.kodeDaerah || '',
      kualifikasi,
      jenjang: ktaRequest.jenjang,
      jabatanKerja: ktaRequest.jabatanKerja,
      fotoUrl: ktaRequest.fotoUrl,
    }
  } catch (error) {
    console.error('Error fetching KTA:', error)
    return null
  }
}

export default async function VerifyKTAPage({
  params,
}: {
  params: { id: string; nomorKTA: string }
}) {
  const ktaData = await getKTAData(params.id, params.nomorKTA)

  if (!ktaData) {
    notFound()
  }

  return <VerifyKTAPageClient ktaData={ktaData} />
}
