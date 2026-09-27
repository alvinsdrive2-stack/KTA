import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { getFieldDef, readFieldValue } from '@/lib/kta-change-request'

export const dynamic = 'force-dynamic'

/**
 * Detail satu permohonan perubahan KTA.
 *
 * GET  = detail. BPP/ADMIN/KEUANGAN boleh lihat, DAERAH nggak.
 * POST = putusan Keuangan: { approved: boolean, catatan?: string }.
 *
 * Kalau diterima: kolom KTA-nya di-update, lalu data ditarik ulang dari SIKI —
 * TAPI field yang barusan di-approve dikecualikan dari refresh. Kalau nggak
 * dikecualikan, SIKI yang datanya masih lama bakal langsung nimpa hasil
 * approval, dan permohonannya kelihatan nggak ngefek.
 */

const PELIHAT = ['PUSAT', 'ADMIN', 'KEUANGAN']

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!PELIHAT.includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const row = await prisma.kTAChangeRequest.findUnique({
      where: { id: params.id },
      include: {
        ktaRequest: {
          select: {
            id: true,
            nama: true,
            nik: true,
            idIzin: true,
            nomorKTA: true,
            status: true,
            daerah: { select: { id: true, namaDaerah: true, kodeDaerah: true } },
          },
        },
        requestedByUser: { select: { id: true, name: true, email: true } },
        reviewedByUser: { select: { id: true, name: true } },
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Permohonan nggak ketemu' }, { status: 404 })
    }

    const def = getFieldDef(row.fieldName)

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        fieldLabel: def?.label ?? row.fieldName,
        fieldHint: def?.hint ?? null,
      },
    })
  } catch (error) {
    console.error('Detail permohonan perubahan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Tarik ulang data dari SIKI setelah perubahan diterapkan, TAPI jangan sentuh
 * field yang barusan di-approve.
 *
 * Salinan sadar dari logika di `app/api/kta/[id]/refresh-siki/route.ts` —
 * sengaja nggak dipanggil lewat HTTP ke route itu, karena (a) butuh cookie
 * session yang nggak ada di konteks ini, dan (b) route itu nulis SEMUA field,
 * sementara di sini satu field harus dilewati.
 *
 * Balikin ringkasan buat disimpan di `appliedResult`.
 */
async function refreshSikiKecualiField(
  ktaId: string,
  exceptField: string
): Promise<string> {
  const kta = await prisma.kTARequest.findUnique({
    where: { id: ktaId },
    select: { idIzin: true, ktpUrl: true },
  })

  if (!kta?.idIzin) {
    return 'Refresh SIKI dilewati: KTA ini nggak punya ID Izin (input manual).'
  }

  const { sikiApi } = await import('@/lib/siki-api')
  const sikiData = await sikiApi.getPekerjaByIdIzin(kta.idIzin)

  if (!sikiData?.success || !sikiData.data) {
    return `Refresh SIKI gagal: ${sikiData?.message || 'data nggak ketemu di SIKI'}. Perubahan tetap tersimpan.`
  }

  const data = sikiData.data
  const klasifikasiKualifikasi = (data as any).klasifikasi_kualifikasi?.[0]

  let subklasifikasiId: string | null = null
  let idJabatanKerja: string | null = null
  let jabatanKerja = data.jabatan || 'N/A'
  let jenjang = data.jenjang || ''
  const noTelp = data.telp || data.telepon || ''
  const kodeSubklasifikasi: string | null = klasifikasiKualifikasi
    ? klasifikasiKualifikasi.subklasifikasi || null
    : data.subklasifikasi || null

  if (klasifikasiKualifikasi) {
    idJabatanKerja = klasifikasiKualifikasi.id_jabatan_kerja || null
    jenjang = klasifikasiKualifikasi.jenjang || jenjang
  } else {
    idJabatanKerja = data.jabatan || null
  }

  if (kodeSubklasifikasi) {
    let namaSub = kodeSubklasifikasi
    const dariApi = await sikiApi.getSubklasifikasiName(String(kodeSubklasifikasi))
    if (dariApi) namaSub = dariApi

    let sub = await prisma.subklasifikasi.findUnique({
      where: { kodeSubklasifikasi },
    })

    if (!sub) {
      sub = await prisma.subklasifikasi.create({
        data: {
          idKlasifikasi: kodeSubklasifikasi.substring(0, 2).toUpperCase(),
          idSubklasifikasi: kodeSubklasifikasi.substring(2).toUpperCase(),
          kodeSubklasifikasi,
          subklasifikasi: namaSub,
        },
      })
    } else if (namaSub && sub.subklasifikasi !== namaSub) {
      sub = await prisma.subklasifikasi.update({
        where: { id: sub.id },
        data: { subklasifikasi: namaSub },
      })
    }

    subklasifikasiId = sub.id
  }

  if (idJabatanKerja) {
    const nama = await sikiApi.getJabatanKerjaByCode(String(idJabatanKerja))
    if (nama) jabatanKerja = nama
  }

  // Field yang barusan di-approve DIKECUALIKAN. Sisanya ikut SIKI seperti
  // refresh biasa: foto selalu menang kecuali SIKI balikin null, KTP hasil
  // upload manual dipertahankan.
  const payload: Record<string, unknown> = {}

  if (exceptField !== 'nama') payload.nama = data.nama
  if (exceptField !== 'nik') payload.nik = data.nik
  if (exceptField !== 'jabatanKerja') payload.jabatanKerja = jabatanKerja
  if (exceptField !== 'jenjang') payload.jenjang = jenjang
  if (exceptField !== 'noTelp') payload.noTelp = noTelp
  if (exceptField !== 'email') payload.email = data.email || ''
  if (exceptField !== 'alamat') payload.alamat = data.alamat || ''
  if (exceptField !== 'subklasifikasi') payload.subklasifikasiId = subklasifikasiId

  const fotoBaru = data.fotoUrl
  if (fotoBaru) payload.fotoUrl = fotoBaru

  const ktpBaru = data.ktpUrl
  const ktpLokal =
    typeof kta.ktpUrl === 'string' &&
    kta.ktpUrl.length > 0 &&
    !kta.ktpUrl.startsWith('http')
  if (ktpBaru && !ktpLokal) payload.ktpUrl = ktpBaru

  if (Object.keys(payload).length === 0) {
    return 'Refresh SIKI: nggak ada field lain yang berubah.'
  }

  await prisma.kTARequest.update({ where: { id: ktaId }, data: payload })

  return `Refresh SIKI jalan. ${Object.keys(payload).length} field lain disegarkan, field yang di-approve dipertahankan.`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cuma Keuangan yang memutus.
    if (session.user.role !== 'KEUANGAN') {
      return NextResponse.json(
        { error: 'Cuma Keuangan yang bisa menerima atau menolak permohonan ini' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const approved = body?.approved === true
    const catatan = typeof body?.catatan === 'string' ? body.catatan.trim() : ''

    if (!approved && !catatan) {
      return NextResponse.json(
        { error: 'Alasan penolakan wajib diisi' },
        { status: 400 }
      )
    }

    const row = await prisma.kTAChangeRequest.findUnique({
      where: { id: params.id },
    })

    if (!row) {
      return NextResponse.json({ error: 'Permohonan nggak ketemu' }, { status: 404 })
    }

    if (row.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Permohonan ini sudah diputus sebelumnya' },
        { status: 409 }
      )
    }

    const def = getFieldDef(row.fieldName)
    if (!def) {
      // Datanya ada di DB tapi fieldnya udah dicabut dari whitelist. Jangan
      // diterapin — nama kolomnya nggak bisa dipercaya lagi.
      return NextResponse.json(
        { error: `Field "${row.fieldName}" udah nggak didukung. Tolak permohonan ini.` },
        { status: 400 }
      )
    }

    if (!approved) {
      await prisma.kTAChangeRequest.update({
        where: { id: row.id },
        data: {
          status: 'REJECTED',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          catatan,
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Permohonan ditolak',
      })
    }

    // ---- Diterima ----
    // Urutannya penting: status di-klaim dulu lewat updateMany dengan syarat
    // masih PENDING. Kalau dua request masuk bareng, cuma satu yang dapet
    // count=1 — yang satunya berhenti di sini, bukan ikut nerapin perubahan.
    const klaim = await prisma.kTAChangeRequest.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        catatan: catatan || null,
      },
    })

    if (klaim.count === 0) {
      return NextResponse.json(
        { error: 'Permohonan ini baru aja diputus. Muat ulang halamannya.' },
        { status: 409 }
      )
    }

    // Terapin ke kolom KTA. `def.key` udah lewat whitelist, jadi aman dipakai
    // sebagai computed key — bukan input mentah dari body.
    let hasil: string
    try {
      await prisma.kTARequest.update({
        where: { id: row.ktaRequestId },
        data: { [def.key]: row.newValue },
      })

      // Verifikasi: baca ulang kolomnya, jangan cuma percaya "tadi nggak error".
      const sesudah = await prisma.kTARequest.findUnique({
        where: { id: row.ktaRequestId },
        select: { [def.key]: true },
      })
      const nilaiSekarang = readFieldValue(
        (sesudah ?? {}) as Record<string, unknown>,
        def.key
      )

      hasil =
        nilaiSekarang === row.newValue
          ? `${def.label} diperbarui.`
          : `${def.label} di-update tapi nilai terbaca "${nilaiSekarang}", bukan "${row.newValue}". Cek manual.`
    } catch (err) {
      const pesan = err instanceof Error ? err.message : 'error nggak dikenal'
      await prisma.kTAChangeRequest.update({
        where: { id: row.id },
        data: { appliedResult: `GAGAL menerapkan ${def.label}: ${pesan}` },
      })
      return NextResponse.json(
        { error: `Gagal menerapkan perubahan: ${pesan}` },
        { status: 500 }
      )
    }

    // Baru tarik ulang dari SIKI, dengan field yang barusan di-approve
    // dikecualikan biar nggak langsung ketimpa balik.
    let hasilRefresh: string
    try {
      hasilRefresh = await refreshSikiKecualiField(row.ktaRequestId, def.key)
    } catch (err) {
      const pesan = err instanceof Error ? err.message : 'error nggak dikenal'
      hasilRefresh = `Refresh SIKI error: ${pesan}. Perubahan tetap tersimpan.`
    }

    const diterapkan = `${hasil} ${hasilRefresh}`

    await prisma.kTAChangeRequest.update({
      where: { id: row.id },
      data: { appliedAt: new Date(), appliedResult: diterapkan },
    })

    return NextResponse.json({
      success: true,
      message: `Permohonan diterima. ${hasil}`,
      data: { appliedResult: diterapkan },
    })
  } catch (error) {
    console.error('Putusan permohonan perubahan error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
