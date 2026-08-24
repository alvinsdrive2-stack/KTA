import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { checkUpgradeScenario } from '@/lib/kta-upgrade'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      nik,
      nama,
      jabatanKerja,
      subklasifikasi,
      jenjang,
      noTelp,
      email,
      alamat,
      ktpUrl,
      fotoUrl,
      fotoData,
      ktpData,
      daerahId
    } = body

    // Validate required fields
    if (!nik || !nama || !jabatanKerja || !subklasifikasi || !jenjang || !noTelp || !email || !alamat) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate files (require URLs for uploaded files)
    if (!ktpUrl) {
      return NextResponse.json({ error: 'KTP file is required' }, { status: 400 })
    }
    if (!fotoUrl) {
      return NextResponse.json({ error: 'Foto file is required' }, { status: 400 })
    }

    // Determine daerah
    let finalDaerahId = daerahId

    // If no daerah specified and user is not pusat/nasional, use user's daerah
    if (!finalDaerahId && session.user.daerahId) {
      finalDaerahId = session.user.daerahId
    }

    if (!finalDaerahId) {
      return NextResponse.json({ error: 'Daerah is required' }, { status: 400 })
    }

    // Get pricing
    const jenjangNum = parseInt(jenjang, 10)
    const hargaBase = jenjangNum >= 7 ? 300000 : 100000

    // Get diskon from daerah
    const daerah = await prisma.daerah.findUnique({
      where: { id: finalDaerahId },
      select: { diskonPersen: true }
    })

    const diskonPersen = daerah?.diskonPersen || 0
    const hargaFinal = Math.floor(hargaBase - (hargaBase * diskonPersen / 100))

    // Check for upgrade scenario
    const upgradeCheck = await checkUpgradeScenario(
      nik,
      jenjangNum,
      subklasifikasi
    )

    if (!upgradeCheck.canUpgrade) {
      return NextResponse.json({
        error: upgradeCheck.reason || 'Tidak dapat membuat permohonan KTA'
      }, { status: 400 })
    }

    // Calculate final price with upgrade discount if applicable
    let finalHargaBase = hargaBase
    let finalHargaFinal = hargaFinal
    let finalHargaUpgrade: number | undefined
    let finalHargaLama: number | undefined

    if (upgradeCheck.isUpgrade) {
      finalHargaBase = upgradeCheck.hargaBaru
      // Upgrade fee = hargaBaru - hargaLama, then apply discount to the upgrade fee
      finalHargaFinal = upgradeCheck.hargaUpgrade - (upgradeCheck.hargaUpgrade * diskonPersen / 100)
      finalHargaUpgrade = upgradeCheck.hargaUpgrade
      finalHargaLama = upgradeCheck.hargaLama
    }

    // Manual input tanpa ID Izin
    const idIzin = null

    // Create KTA Request
    const ktaRequest = await prisma.kTARequest.create({
      data: {
        idIzin,
        nik,
        nama,
        jabatanKerja,
        subklasifikasi,
        jenjang,
        noTelp,
        email,
        alamat,
        ktpUrl: ktpUrl,
        fotoUrl: fotoUrl,
        daerahId: finalDaerahId,
        requestedBy: session.user.id,
        status: upgradeCheck.isUpgrade ? 'UPGRADE_PENDING' : 'DRAFT',
        hargaRegion: finalHargaFinal,
        diskonPersen,
        hargaBase: finalHargaBase,
        hargaFinal: finalHargaFinal,
        tanggalDaftar: new Date(),
        isUpgrade: upgradeCheck.isUpgrade,
        upgradeFromKtaId: upgradeCheck.existingKta?.id,
        hargaLama: finalHargaLama,
        hargaUpgrade: finalHargaUpgrade,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Permohonan KTA berhasil dibuat',
      data: {
        ...ktaRequest,
        pricing: {
          isUpgrade: upgradeCheck.isUpgrade,
          upgradeInfo: upgradeCheck.isUpgrade ? {
            oldJenjang: upgradeCheck.oldJenjang,
            newJenjang: upgradeCheck.newJenjang,
            hargaLama: upgradeCheck.hargaLama,
            hargaBaru: upgradeCheck.hargaBaru,
            hargaUpgrade: upgradeCheck.hargaUpgrade,
          } : null
        }
      }
    })

  } catch (error) {
    console.error('Create manual KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
