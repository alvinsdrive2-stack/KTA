import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { deriveSikiFields, isLocalUpload } from '@/lib/siki-fields'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the KTA request
    const ktaRequest = await prisma.kTARequest.findUnique({
      where: { id: params.id },
    })

    if (!ktaRequest) {
      return NextResponse.json({ error: 'KTA request not found' }, { status: 404 })
    }

    // Check access - PUSAT/ADMIN can access all, DAERAH only their daerah, others only their own
    switch (session.user.role) {
      case 'DAERAH':
        if (session.user.daerahId !== ktaRequest.daerahId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        break
      case 'PUSAT':
      case 'ADMIN':
        break
      default:
        if (ktaRequest.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        break
    }

    // Manual input tanpa ID Izin, gak ada data SIKI
    if (!ktaRequest.idIzin) {
      return NextResponse.json(
        { error: 'Data input manual tidak memiliki ID Izin untuk di-refresh dari SIKI' },
        { status: 400 }
      )
    }

    // Directly fetch from SIKI API
    const { sikiApi } = await import('@/lib/siki-api')
    const sikiData = await sikiApi.getPekerjaByIdIzin(ktaRequest.idIzin)

    if (!sikiData || !sikiData.success) {
      return NextResponse.json(
        { error: sikiData?.message || 'Data tidak ditemukan di SIKI' },
        { status: 400 }
      )
    }

    // Debug: Log SIKI data structure
    console.log('SIKI Raw Data:', JSON.stringify(sikiData.data, null, 2))

    // Penurunan field ada di `lib/siki-fields.ts` — dipakai bareng sama backfill
    // di `lib/kta-upgrade.ts`, biar dua tempat itu nggak punya salinan aturan
    // yang bisa menyimpang.
    const fields = await deriveSikiFields(sikiData.data, sikiApi, {
      ktpUrl: ktaRequest.ktpUrl,
      fotoUrl: ktaRequest.fotoUrl,
    })

    // Update KTA request with fresh data from SIKI
    const updatedKTA = await prisma.kTARequest.update({
      where: { id: params.id },
      data: {
        nik: fields.nik,
        nama: fields.nama,
        jabatanKerja: fields.jabatanKerja,
        subklasifikasiId: fields.subklasifikasiId,
        jenjang: fields.jenjang,
        noTelp: fields.noTelp,
        email: fields.email,
        alamat: fields.alamat,
        // KTP hasil upload manual dipertahankan; URL SIKI cuma nge-update kalau
        // kolomnya masih kosong atau masih nunjuk ke SIKI. Foto selalu ikut SIKI
        // selama responsnya nggak null — lihat resolveFotoUrl().
        ktpUrl: fields.ktpUrl,
        fotoUrl: fields.fotoUrl,
      },
    })

    // Laporkan field dokumen yang nggak ikut berubah, biar UI bisa kasih tahu
    // anggota bahwa url SIKI beda tapi dokumen manualnya dipertahankan.
    //
    // Syaratnya dua-duanya harus benar: SIKI BENAR-BENAR NGIRIM dokumen, DAN
    // dokumen itu ditolak karena yang lama hasil upload manual. Banding lama
    // (`resolveKtpUrl(...) !== incoming`) salah di kasus SIKI nggak ngirim
    // apa-apa — `resolveKtpUrl` balikin `current` kalau `incoming` falsy, jadi
    // `current !== undefined` selalu benar dan "KTP" dilaporkan ke-skip padahal
    // SIKI nggak punya apa-apa.
    const skippedDocuments: string[] = []
    const incomingKtp = sikiData.data?.ktpUrl
    if (incomingKtp && ktaRequest.ktpUrl && isLocalUpload(ktaRequest.ktpUrl)) {
      skippedDocuments.push('KTP')
    }

    return NextResponse.json({
      success: true,
      message: 'Data SIKI berhasil diperbarui',
      data: updatedKTA,
      ...(skippedDocuments.length > 0 ? { skippedDocuments } : {}),
    })
  } catch (error) {
    console.error('Refresh SIKI error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
