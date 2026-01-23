import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-helpers'
import { checkUpgradeScenario } from '@/lib/kta-upgrade'

export const dynamic = 'force-dynamic'

// Helper function to get base price by jenjang
function getHargaBaseByJenjang(jenjang: string): number {
  const jenjangNum = parseInt(jenjang, 10)
  // Jenjang 7-9 = Rp. 300.000, Jenjang 1-6 = Rp. 100.000
  return jenjangNum >= 7 ? 300000 : 100000
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await authMiddleware(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { idIzin, sikiData, fotoData, ktpData } = body

    if (!idIzin || !sikiData) {
      return NextResponse.json(
        { error: 'ID Izin dan data SIKI diperlukan. Pastikan Anda telah mencari data SIKI terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Get daerahId from request or session
    let daerahId = body.daerahId

    // Check if user can access the requested daerah
    const userRole = session.user.role
    const userDaerahKode = session.user.daerah?.kodeDaerah

    // PUSAT/ADMIN users or users with daerah "00" can assign to any daerah
    const canAssignAnyDaerah = userRole === 'PUSAT' || userRole === 'ADMIN' || userDaerahKode === '00'

    if (!daerahId) {
      // If no daerahId specified, use user's own daerah
      daerahId = session.user.daerahId

      if (!daerahId) {
        // Get first available daerah as fallback
        const defaultDaerah = await prisma.daerah.findFirst()
        daerahId = defaultDaerah?.id || 'DEFAULT'
      }
    } else {
      // If daerahId is specified, check if user can assign to that daerah
      if (!canAssignAnyDaerah && daerahId !== session.user.daerahId) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses untuk menugaskan KTA ke daerah lain' },
          { status: 403 }
        )
      }
    }

    // Log assignment info
    console.log('KTA Create Assignment:', {
      userId: session.user.id,
      userRole,
      userDaerahKode,
      assignedDaerahId: daerahId,
      canAssignAnyDaerah
    })

    // Get daerah diskon
    const daerah = await prisma.daerah.findUnique({
      where: { id: daerahId },
      select: { diskonPersen: true }
    })

    const diskonPersen = daerah?.diskonPersen ?? 0

    // Calculate pricing based on jenjang
    const jenjang = sikiData.jenjang
    const hargaBase = getHargaBaseByJenjang(jenjang)
    const hargaFinal = hargaBase - (hargaBase * diskonPersen / 100)

    // Find subklasifikasi by kodeSubklasifikasi to ensure it exists
    // This needs to be done BEFORE upgrade check since it uses subklasifikasiText
    let finalSubklasifikasiId = sikiData.subklasifikasiId
    let subklasifikasiText = null
    if (sikiData.klasifikasi?.kodeSubklasifikasi) {
      const existingSub = await prisma.subklasifikasi.findUnique({
        where: { kodeSubklasifikasi: sikiData.klasifikasi.kodeSubklasifikasi }
      })
      if (existingSub) {
        console.log('Found existing subklasifikasi by kode:', sikiData.klasifikasi.kodeSubklasifikasi, 'ID:', existingSub.id)
        finalSubklasifikasiId = existingSub.id
        subklasifikasiText = existingSub.subklasifikasi
      } else {
        console.log('⚠️ Subklasifikasi with kode not found, creating new one')
        // Create it if not exists
        const idKlasifikasi = sikiData.klasifikasi.kodeSubklasifikasi.substring(0, 2).toUpperCase()
        const idSubklasifikasi = sikiData.klasifikasi.kodeSubklasifikasi.substring(2).toUpperCase()
        const newSub = await prisma.subklasifikasi.create({
          data: {
            idKlasifikasi: idKlasifikasi,
            idSubklasifikasi: idSubklasifikasi,
            kodeSubklasifikasi: sikiData.klasifikasi.kodeSubklasifikasi,
            subklasifikasi: sikiData.klasifikasi.subklasifikasi || sikiData.klasifikasi.kodeSubklasifikasi,
          }
        })
        finalSubklasifikasiId = newSub.id
        subklasifikasiText = newSub.subklasifikasi
        console.log('Created new subklasifikasi with ID:', finalSubklasifikasiId)
      }
    }

    // Check for upgrade scenario
    const jenjangNum = parseInt(jenjang, 10)
    const upgradeCheck = await checkUpgradeScenario(
      sikiData.nik,
      jenjangNum,
      subklasifikasiText || ''
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
      // Apply discount to hargaBaru, then subtract hargaLama (what they already paid)
      const hargaBaruAfterDiskon = upgradeCheck.hargaBaru - (upgradeCheck.hargaBaru * diskonPersen / 100)
      finalHargaFinal = hargaBaruAfterDiskon - upgradeCheck.hargaLama
      finalHargaUpgrade = upgradeCheck.hargaUpgrade
      finalHargaLama = upgradeCheck.hargaLama
    }

    // Check if KTA request already exists
    const existingRequest = await prisma.kTARequest.findUnique({
      where: { idIzin: idIzin }
    })

    // Use original SIKI URLs directly without caching
    // Base64 data can still be provided as fallback for geo-blocked URLs
    const fotoUrl = sikiData.fotoUrl || null
    const ktpUrl = sikiData.ktpUrl || null

    let ktaRequest
    if (existingRequest) {
      // Update existing request
      console.log('Updating existing request with subklasifikasiId:', finalSubklasifikasiId)
      ktaRequest = await prisma.kTARequest.update({
        where: { idIzin: idIzin },
        data: {
          nik: sikiData.nik,
          nama: sikiData.nama,
          jabatanKerja: sikiData.jabatanKerja || sikiData.jabatan || 'N/A',
          subklasifikasi: subklasifikasiText,
          subklasifikasiId: finalSubklasifikasiId || null,
          jenjang: sikiData.jenjang,
          noTelp: sikiData.telp || '',
          email: sikiData.email || '',
          alamat: sikiData.alamat || '',
          tanggalDaftar: sikiData.tgl_daftar ? new Date(sikiData.tgl_daftar) : new Date(),
          ktpUrl: ktpUrl,
          fotoUrl: fotoUrl,
          fotoData: fotoData, // Store base64 data for geo-blocked URLs
          hargaRegion: finalHargaFinal,
          hargaBase: finalHargaBase,
          diskonPersen,
          hargaFinal: finalHargaFinal,
          isUpgrade: upgradeCheck.isUpgrade,
          upgradeFromKtaId: upgradeCheck.existingKta?.id,
          hargaLama: finalHargaLama,
          hargaUpgrade: finalHargaUpgrade,
        }
      })
      console.log('After update, subklasifikasiId:', ktaRequest.subklasifikasiId)
    } else {
      // Create new KTA request
      console.log('Creating new request with subklasifikasiId:', finalSubklasifikasiId)
      ktaRequest = await prisma.kTARequest.create({
        data: {
          idIzin: idIzin,
          daerahId: daerahId,
          requestedBy: session.user.id,
          nik: sikiData.nik,
          nama: sikiData.nama,
          jabatanKerja: sikiData.jabatanKerja || sikiData.jabatan || 'N/A',
          subklasifikasi: subklasifikasiText,
          subklasifikasiId: finalSubklasifikasiId || null,
          jenjang: sikiData.jenjang,
          noTelp: sikiData.telp || '',
          email: sikiData.email || '',
          alamat: sikiData.alamat || '',
          tanggalDaftar: sikiData.tgl_daftar ? new Date(sikiData.tgl_daftar) : new Date(),
          status: upgradeCheck.isUpgrade ? 'UPGRADE_PENDING' : 'DRAFT',
          hargaRegion: finalHargaFinal,
          hargaBase: finalHargaBase,
          diskonPersen,
          hargaFinal: finalHargaFinal,
          ktpUrl: ktpUrl,
          fotoUrl: fotoUrl,
          fotoData: fotoData, // Store base64 data for geo-blocked URLs
          isUpgrade: upgradeCheck.isUpgrade,
          upgradeFromKtaId: upgradeCheck.existingKta?.id,
          hargaLama: finalHargaLama,
          hargaUpgrade: finalHargaUpgrade,
        },
      })
      console.log('After create, subklasifikasiId:', ktaRequest.subklasifikasiId)
    }

    return NextResponse.json({
      success: true,
      data: {
        ktaRequest,
        sikiData: sikiData,
        pricing: {
          jenjang,
          hargaBase: finalHargaBase,
          diskonPersen,
          hargaFinal: finalHargaFinal,
          isUpgrade: upgradeCheck.isUpgrade,
          upgradeInfo: upgradeCheck.isUpgrade ? {
            oldJenjang: upgradeCheck.oldJenjang,
            newJenjang: upgradeCheck.newJenjang,
            hargaLama: upgradeCheck.hargaLama,
            hargaBaru: upgradeCheck.hargaBaru,
            hargaUpgrade: upgradeCheck.hargaUpgrade,
          } : null
        }
      },
    })
  } catch (error) {
    console.error('Create KTA error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}