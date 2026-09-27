import { NextRequest, NextResponse } from 'next/server'
import { authMiddleware } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import {
  KTA_CHANGE_FIELDS,
  readFieldValue,
  readSikiValue,
  isSameValue,
} from '@/lib/kta-change-request'

export const dynamic = 'force-dynamic'

/**
 * Pembanding nilai SIKI vs nilai KTA yang sekarang.
 *
 * Dipakai halaman BPP: begitu ID Izin diisi, langsung kelihatan field mana yang
 * beda antara SIKI dan data di sistem — jadi BPP nggak perlu nebak-nebak mana
 * yang mau diajukan.
 *
 * Body: { idIzin: string, ktaRequestId?: string }
 *
 * `ktaRequestId` opsional — tanpa itu, cuma nilai SIKI-nya yang dikembalikan.
 * Nilai "sekarang" diambil dari DATABASE, bukan dari SIKI, karena yang mau
 * dibandingin itu SIKI vs data yang dipakai sistem.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cuma BPP yang butuh ini. ADMIN ikut boleh buat keperluan pengecekan.
    if (!['PUSAT', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const idIzin = typeof body?.idIzin === 'string' ? body.idIzin.trim() : ''
    const ktaRequestId =
      typeof body?.ktaRequestId === 'string' ? body.ktaRequestId : ''

    if (!idIzin) {
      return NextResponse.json({ error: 'ID Izin harus diisi' }, { status: 400 })
    }

    const { sikiApi } = await import('@/lib/siki-api')
    const sikiResponse = await sikiApi.getPekerjaByIdIzin(idIzin)

    if (!sikiResponse?.success || !sikiResponse.data) {
      return NextResponse.json(
        { error: sikiResponse?.message || 'Data nggak ketemu di SIKI' },
        { status: 400 }
      )
    }

    const sikiData = sikiResponse.data as unknown as Record<string, unknown>

    // Ambil KTA pembanding kalau diminta.
    let kta: Record<string, unknown> | null = null

    if (ktaRequestId) {
      const ditemukan = await prisma.kTARequest.findUnique({
        where: { id: ktaRequestId },
        select: {
          id: true,
          idIzin: true,
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
      if (ditemukan) kta = ditemukan as unknown as Record<string, unknown>
    }

    // Satu baris per field yang didukung. `beda: true` = SIKI dan sistem nggak
    // sama, itu yang ditonjolin di UI.
    const perbandingan = KTA_CHANGE_FIELDS.map((def) => {
      const siki = readSikiValue(sikiData, def)
      const sekarang = kta ? readFieldValue(kta, def.key) : null

      return {
        field: def.key,
        label: def.label,
        hint: def.hint ?? null,
        // null = nggak ada padanannya di SIKI, jadi nggak bisa dibandingin.
        sikiValue: siki,
        currentValue: sekarang,
        bisaDibanding: siki !== null && sekarang !== null,
        beda: siki !== null && sekarang !== null ? !isSameValue(siki, sekarang) : false,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        idIzin,
        perbandingan,
        // Nilai mentah SIKI, biar form bisa nyaranin nilai baru langsung.
        siki: {
          nama: sikiData.nama ?? null,
          nik: sikiData.nik ?? null,
          jabatan: sikiData.jabatan ?? null,
          jenjang: sikiData.jenjang ?? null,
          telp: sikiData.telp ?? sikiData.telepon ?? null,
          email: sikiData.email ?? null,
          alamat: sikiData.alamat ?? null,
        },
        ktaDitemukan: kta !== null,
      },
    })
  } catch (error) {
    console.error('Preview permohonan perubahan error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
